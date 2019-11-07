'use strict';

const path = require('path');
const fs = require('fs');
const TypeDoc = require('typedoc');
const ejs = require('ejs');

const packagesDir = path.resolve(__dirname, '..', 'packages');
const outDir = path.resolve(__dirname, '..', 'docs');

const template = ejs.compile(
    fs.readFileSync(path.join(__dirname, 'doc-index-template.html.ejs'), 'utf8'),
);

function buildDocsForPackage(pkg) {
    const app = new TypeDoc.Application({
        mode: 'file',
        target: 'ES6',
        module: 'es6',
        moduleResolution: 'node',
        exclude: '**/__tests__/**',
        ignoreCompilerErrors: true,
        excludePrivate: true,
        excludeNotExported: true,
        stripInternal: true,
        excludeExternals: true,
        suppressExcessPropertyErrors: true,
        suppressImplicitAnyIndexErrors: true,
        readme: 'none',
    });

    console.log(`Generating docs for ${pkg.dirName}`);

    const project = app.convert(app.expandInputFiles([pkg.srcPath]));
    if (!project) {
        console.error(`Failed to generate docs for ${pkg.name}`);
        return;
    }

    app.generateDocs(project, path.join(outDir, pkg.dirName));

    return {
        href: `/${pkg.dirName}`,
        title: pkg.name,
    };
}

const links = fs
    .readdirSync(packagesDir, { encoding: 'utf8', withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(dir => {
        const absPath = path.join(packagesDir, dir.name);
        const srcPath = path.join(absPath, 'src');
        const packageJson = require(path.join(absPath, 'package.json'));
        return {
            name: packageJson.name,
            isPrivate: packageJson.private,
            srcPath: fs.existsSync(srcPath) ? srcPath : undefined,
            dirName: dir.name,
        };
    })
    .filter(pkg => !pkg.isPrivate && pkg.srcPath)
    .map(buildDocsForPackage);

console.log('Generating Index');
const indexContent = template({ links });
fs.writeFileSync(path.join(outDir, 'index.html'), indexContent, 'utf8');

console.log('All done!');
