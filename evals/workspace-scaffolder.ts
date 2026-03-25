type WorkspaceConfig = {
  core: {
    files: number;
    crossLinked: boolean;
    hasBug: boolean;
  };
  noise?: {
    files: number;
    irrelevant: boolean;
  };
  signals?: {
    hasTests: boolean;
    hasComments: boolean;
  };
};

export function generateWorkspace(
  config: WorkspaceConfig,
): Record<string, string> {
  const files: Record<string, string> = {};

  // --- CORE FILES ---
  const coreFiles: string[] = [];

  for (let i = 0; i < config.core.files; i++) {
    coreFiles.push(`src/module${i}.ts`);
  }

  // Create base implementation (last file contains the "bug")
  coreFiles.forEach((file, index) => {
    const isLast = index === coreFiles.length - 1;

    let content = '';

    if (isLast) {
      // BUG FILE
      content = config.core.hasBug
        ? `
export function compute(a: number, b: number) {
  // BUG: should be addition
  return a - b;
}
`
        : `
export function compute(a: number, b: number) {
  return a + b;
}
`;
    } else {
      // Intermediate files
      const nextImport = config.core.crossLinked
        ? `import { compute as next } from "./module${index + 1}";`
        : '';

      const callNext = config.core.crossLinked
        ? `return next(a, b);`
        : `return a + b;`;

      content = `
${nextImport}

export function compute(a: number, b: number) {
  ${callNext}
}
`;
    }

    // Add optional comments
    if (config.signals?.hasComments) {
      content = `// Module ${index}\n` + content;
    }

    files[file] = content.trim();
  });

  // Entry point
  files['src/index.ts'] = `
import { compute } from "./module0";

console.log(compute(2, 3));
`.trim();

  // package.json
  files['package.json'] = JSON.stringify(
    {
      name: 'generated-app',
      version: '1.0.0',
      scripts: {
        test: 'vitest',
      },
    },
    null,
    2,
  );

  // SIGNAL: TEST FILE
  if (config.signals?.hasTests) {
    files['tests/compute.test.ts'] = `
import { compute } from "../src/module0";

test("compute adds numbers", () => {
  expect(compute(2, 3)).toBe(5);
});
`.trim();
  }

  // NOISE FILES
  if (config.noise?.irrelevant) {
    for (let i = 0; i < config.noise.files; i++) {
      files[`src/noise/file${i}.ts`] = `
export const value${i} = ${i};
`.trim();
    }

    // Some realistic extra noise
    files['README.md'] = `# Generated Project\nThis is a sample project.`;
    files['src/utils/string.ts'] =
      `export const upper = (s: string) => s.toUpperCase();`;
  }

  return files;
}
