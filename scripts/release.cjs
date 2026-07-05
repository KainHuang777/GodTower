const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Read package.json
const pkgPath = path.join(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const currentVersion = pkg.version; // e.g. "0.1.55"

const parts = currentVersion.split('.').map(Number);
// Increment minor version, reset patch to 0
parts[1] += 1;
parts[2] = 0;
const newVersion = parts.join('.'); // e.g. "0.2.0"
const gameVersionUi = `V${parts[0]}.${parts[1]}${parts[2]}`; // V0.20

console.log(`Current Version: ${currentVersion}`);
console.log(`New Version: ${newVersion} (UI: ${gameVersionUi})`);

// 2. Update package.json
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log(`Updated package.json to version ${newVersion}`);

// 3. Update src/main.ts GAME_VERSION
const mainTsPath = path.join(__dirname, '../src/main.ts');
let mainTsContent = fs.readFileSync(mainTsPath, 'utf8');
const versionRegex = /const GAME_VERSION = '[^']+';/;
mainTsContent = mainTsContent.replace(versionRegex, `const GAME_VERSION = '${gameVersionUi}';`);
fs.writeFileSync(mainTsPath, mainTsContent, 'utf8');
console.log(`Updated src/main.ts GAME_VERSION to ${gameVersionUi}`);

// 4. Update index.html version tag
const indexHtmlPath = path.join(__dirname, '../index.html');
let indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
const indexVersionRegex = /<div id="gameVersion"[^>]*>[^<]+<\/div>/;
indexHtmlContent = indexHtmlContent.replace(indexVersionRegex, `<div id="gameVersion" style="color: var(--text-muted); font-size: 0.85rem; margin-top: -15px; margin-bottom: 5px; font-weight: 500;">${gameVersionUi}<\/div>`);
fs.writeFileSync(indexHtmlPath, indexHtmlContent, 'utf8');
console.log(`Updated index.html to ${gameVersionUi}`);

// 5. Generate Releasenote.md from Update.txt
const updateTxtPath = path.join(__dirname, '../Update.txt');
const updateTxt = fs.readFileSync(updateTxtPath, 'utf8');

const lines = updateTxt.split('\n');
const recentUpdates = [];
let collecting = false;
for (const line of lines) {
  if (line.includes('Update)')) {
    // Collect all updates from 54th Update upwards (since V0.1.0 was established)
    const match = line.match(/(\d+)(?:nd|rd|th|st)/);
    const updateNum = match ? parseInt(match[1]) : 0;
    if (updateNum < 54) {
      break;
    }
    collecting = true;
  }
  if (collecting) {
    recentUpdates.push(line);
  }
}

const recentNotes = recentUpdates.join('\n').trim();
const simplifiedNotes = recentNotes
  .replace(/\r/g, '')
  .split('\n')
  .filter(l => l.trim() !== '')
  .map(l => {
    return l.startsWith('-') || l.startsWith('  ') ? l : `### ${l}`;
  })
  .join('\n');

const releaseNotesPath = path.join(__dirname, '../Releasenote.md');
let currentReleaseNotes = fs.readFileSync(releaseNotesPath, 'utf8');

const header = '# 遊戲更新日誌 (Release Notes)\n\n';
const newEntry = `## ${gameVersionUi}\n${simplifiedNotes}\n\n`;

if (!currentReleaseNotes.includes(`## ${gameVersionUi}`)) {
  currentReleaseNotes = currentReleaseNotes.replace(header, `${header}${newEntry}`);
  fs.writeFileSync(releaseNotesPath, currentReleaseNotes, 'utf8');
  console.log(`Updated Releasenote.md with new release notes.`);
}

// 6. Run build
console.log('Running npm run build...');
execSync('npm run build', { stdio: 'inherit' });
console.log('Build completed successfully.');

// 7. Git commit, tag, and push
try {
  console.log('Executing git commits...');
  execSync('git add package.json package-lock.json src/main.ts index.html Releasenote.md Update.txt vite.config.ts .github/workflows/deploy.yml', { stdio: 'inherit' });
  execSync(`git commit -m "release: ${gameVersionUi}"`, { stdio: 'inherit' });
  try {
    execSync(`git tag -d ${gameVersionUi}`, { stdio: 'ignore' });
  } catch (e) {}
  execSync(`git tag -a ${gameVersionUi} -m "Release ${gameVersionUi}"`, { stdio: 'inherit' });
  console.log('Git commit and tag created.');
  
  console.log('Pushing to GitHub...');
  execSync('git push origin main --tags', { stdio: 'inherit' });
  console.log('Pushed to GitHub successfully!');
} catch (gitErr) {
  console.error('Git commands failed. Please check git configuration or credentials.');
  console.error(gitErr.message);
}
