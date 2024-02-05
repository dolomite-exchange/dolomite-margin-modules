import path from 'path';

export default function getScriptName(fileName: string): string {
  return path.basename(fileName).slice(0, -3);
}
