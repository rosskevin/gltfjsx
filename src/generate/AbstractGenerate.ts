import { Biome } from '@biomejs/js-api/nodejs'
import { Project, ScriptTarget, type SourceFile, ts } from 'ts-morph'

/**
 * Lazily create a single Biome WASM instance for formatting generated code. WASM init is costly, so it is created
 * once and reused across every format call. The inline `applyConfiguration` is authoritative — formatting never
 * depends on a `biome.json` in the user's working directory. `indentStyle: 'space'` is set explicitly because
 * Biome defaults to tabs.
 */
function createFormatter() {
  const biome = new Biome()
  const { projectKey } = biome.openProject('/')
  biome.applyConfiguration(projectKey, {
    formatter: { enabled: true, indentStyle: 'space', indentWidth: 2, lineWidth: 100 },
    javascript: {
      formatter: {
        bracketSameLine: true,
        jsxQuoteStyle: 'double',
        quoteStyle: 'single',
        semicolons: 'asNeeded',
      },
    },
  })
  return { biome, projectKey }
}

let formatter: ReturnType<typeof createFormatter> | undefined

/**
 * Abstract class for a code generator.
 *
 * @see https://ts-ast-viewer.com to help navigate/understand the AST
 */
export abstract class AbstractGenerate {
  // leave public to allow for external manipulation - in case the user does not want to subclass
  public project: Project
  /** subclass must assign */
  public src!: SourceFile

  constructor() {
    this.project = new Project({
      compilerOptions: {
        jsx: ts.JsxEmit.Preserve,
        target: ScriptTarget.ESNext,
      } as any,
      useInMemoryFileSystem: true,
    })
  }

  /**
   * @returns the source as tsx
   */
  public async toTsx() {
    return this.formatCode(this.src.getFullText(), 'index.tsx')
  }

  /**
   * @returns the source as jsx
   */
  public async toJsx() {
    // npx tsc --jsx preserve -t esnext --outDir js --noEmit false
    const result = this.project.emitToMemory()
    return this.formatCode(result.getFiles()[0].text, 'index.jsx')
  }

  protected async formatCode(code: string, filePath = 'index.tsx') {
    if (!formatter) formatter = createFormatter()
    const { biome, projectKey } = formatter
    // Biome's formatContent does NOT throw on invalid input — it returns the unformatted source plus syntax
    // diagnostics. Surface those as a hard failure so a malformed generated component never gets written to disk.
    const { content, diagnostics } = biome.formatContent(projectKey, code, { filePath })
    if (diagnostics.length > 0) {
      throw new Error(
        `Generated ${filePath} has syntax errors and could not be formatted:\n${biome.printDiagnostics(
          diagnostics,
          { filePath, fileSource: code },
        )}`,
      )
    }
    return content
  }

  /** convenience */
  protected getInterface(name: string) {
    const i = this.src.getInterface(name)
    if (!i) throw new Error(`${name} interface not found`)
    return i
  }
}
