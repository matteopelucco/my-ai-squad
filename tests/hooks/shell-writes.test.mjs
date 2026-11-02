// Tests for the shell-write check of confined agents. Run: node --test "tests/*/*.test.mjs"
import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { DEFAULT_WRITE_SCOPES } from '../../plugins/squad-core/hooks/lib/rules.mjs';
import { evaluateShellWrites, lex, resolveTarget } from '../../plugins/squad-core/hooks/lib/shell-writes.mjs';

const projectDir = path.resolve('/proj');
const tmpDir = path.resolve('/tmpdir');
const homeDir = path.resolve('/home/u');
const context = (profile) => ({ scopes: DEFAULT_WRITE_SCOPES, profile, projectDir, cwd: projectDir, homeDir, tmpDir });
const analyst = (command) => evaluateShellWrites(command, context('product-analyst'))?.decision ?? 'allow';
const tester = (command) => evaluateShellWrites(command, context('test-engineer'))?.decision ?? 'allow';

describe('lex', () => {
  it('keeps quoted operators inside words and drops heredoc bodies', () => {
    assert.deepEqual(lex(`grep "a > b" x.md`), [{ w: 'grep' }, { w: 'a > b' }, { w: 'x.md' }]);
    const tokens = lex("cat > /tmp/c.md <<'EOF'\n> quote\nrm -rf src\nEOF\nls");
    assert.deepEqual(tokens, [{ w: 'cat' }, { op: '>' }, { w: '/tmp/c.md' }, { op: '<<' }, { op: ';' }, { w: 'ls' }]);
  });
  it('treats descriptor redirections as part of the operator', () => {
    assert.deepEqual(lex('npm test 2>&1'), [{ w: 'npm' }, { w: 'test' }, { op: '>&' }, { w: '1' }]);
  });
});

describe('evaluateShellWrites', () => {
  const denied = [
    // the case that motivated the check: a spec rewritten from the shell, outside the scope or not
    'node -e "require(\'fs\').writeFileSync(\'specs/55.md\', s)"',
    "python3 - <<'EOF'\nopen('specs/55.md','w').write(s)\nEOF",
    'echo "print(1)" | python3',
    'echo x > src/a.ts',
    'echo x >> README.md',
    'cat notes | tee src/a.ts',
    'sed -i "s/a/b/" src/a.ts',
    'sed --in-place=.bak -e s/a/b/ src/a.ts',
    'perl -pi -e "s/a/b/" src/a.ts',
    'cp specs/a.md src/a.md',
    'mv specs/a.md src/a.md',
    'rm -rf src',
    'touch package.json',
    'git checkout -- src/a.ts',
    'git restore src/a.ts',
    'git apply patch.diff',
    'git stash',
    'git reset --hard',
    'cd src && echo x > a.ts',
    'bash -c "echo x > src/a.ts"',
    'sh -c \'rm src/a.ts\'',
    'echo x > "$OUT"',
    'curl -o src/a.js https://example.com/a.js',
    'Set-Content -Path src/a.ts -Value "x"',
    '"x" | Out-File src/a.ts',
    'Remove-Item -Recurse -Force src',
    'Copy-Item specs/a.md -Destination src/a.md',
    'New-Item -ItemType File src/a.ts',
    '[System.IO.File]::WriteAllText("specs/a.md", "x")',
    'npm test && echo x > src/a.ts',
    'echo x > ../outside.md',
  ];
  for (const command of denied) {
    it(`denies: ${command.split('\n')[0]}`, () => assert.equal(analyst(command), 'deny'));
  }

  const allowed = [
    'ls -la',
    'cat specs/a.md',
    'grep -rn "x > y" src',
    'sed -n 1,40p src/a.ts',
    'gh issue view 12 --json body',
    "cat > /tmp/comment.md <<'EOF'\n> citazione\nrm -rf src\nEOF\ngh issue comment 12 --body-file /tmp/comment.md",
    'echo x > specs/55.md',
    'echo x > $TMPDIR/a.md',
    'cp src/a.ts specs/a.md',
    'git status && git diff 2>/dev/null',
    'git checkout -b feat/1-x',
    'git add specs/a.md && git commit -m "docs: spec"',
    'node --version',
    'Set-Content -Path specs/a.md -Value "x" -Encoding utf8',
    'Get-Content src/a.ts 2>$null',
    'cd docs && echo x > a.md',
  ];
  for (const command of allowed) {
    it(`allows: ${command.split('\n')[0]}`, () => assert.equal(analyst(command), 'allow'));
  }

  it('lets the test engineer run tests but not touch production code', () => {
    assert.equal(tester('npm test'), 'allow');
    assert.equal(tester('npx vitest run tests/a.test.ts'), 'allow');
    assert.equal(tester('node --test tests/'), 'allow');
    assert.equal(tester('echo x > tests/fixture.json'), 'allow');
    assert.equal(tester('echo x > specs/a.md'), 'deny');
  });

  it('explains the refusal and where writing is allowed', () => {
    const { reason } = evaluateShellWrites('echo x > src/a.ts', context('product-analyst'));
    assert.match(reason, /src\/a\.ts/);
    assert.match(reason, /docs\/, specs\//);
    assert.match(reason, /Write\/Edit/);
  });
});

describe('resolveTarget', () => {
  const env = { cwd: projectDir, homeDir, tmpDir };
  it('maps /tmp, ~ and temp variables', () => {
    assert.equal(resolveTarget('/tmp/a', env), path.join(tmpDir, 'a'));
    assert.equal(resolveTarget('~/a', env), path.join(homeDir, 'a'));
    assert.equal(resolveTarget('$env:TEMP/a', env), path.join(tmpDir, 'a'));
    assert.equal(resolveTarget('$X/a', env), null);
  });
  it('maps Git Bash drive paths on Windows', () => {
    assert.match(resolveTarget('/c/x/a', { ...env, platform: 'win32' }), /^[cC]:/);
  });
});
