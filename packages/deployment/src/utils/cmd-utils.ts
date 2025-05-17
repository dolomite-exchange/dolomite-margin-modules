import process from 'process';

export function getCommandlineArg(searchKey: string): string {
  const index = process.argv.indexOf(searchKey);
  if (index === -1) {
    throw new Error(`Could not find key for ${searchKey}`);
  }

  if (process.argv.length <= index + 1) {
    throw new Error(`Could not find value for ${searchKey}`);
  }

  return process.argv[index + 1];
}
