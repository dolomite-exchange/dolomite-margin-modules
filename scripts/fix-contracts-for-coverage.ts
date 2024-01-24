import { execSync } from 'child_process';

async function main() {
  execSync('yarn clean', { stdio: 'inherit' });
  execSync('rm -rf contracts_coverage && cp -r contracts/ contracts_coverage/', { stdio: 'inherit' });
  execSync('python3 ../../scripts/fix-contracts-for-coverage.py', { stdio: 'inherit' });
}

main()
  .then(() => console.log('Fix contracts completed'))
  .catch((err) => {
    console.error('Found error', err.message);
    process.exit(-1);
  });
