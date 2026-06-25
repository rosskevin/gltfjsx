// npm-check-updates config. The `cooldown` predicate keeps ncu from suggesting a version newer than the ~7-day
// install-time cooldown (pnpm-workspace.yaml `minimumReleaseAge`) would accept, so `ncu -u` can't pull brand-new
// (and breaking) releases. @alienfast/* are first-party — exempt them (cooldown 0). The predicate form is only
// honored in .ncurc.js/.cjs, not on the CLI.
module.exports = {
  cooldown: (packageName) => (packageName.startsWith('@alienfast/') ? 0 : '168h'),
  packageFile: './package.json',
  packageManager: 'pnpm',
  reject: [],
  root: true,
}
