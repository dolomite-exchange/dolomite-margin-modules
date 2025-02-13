export async function checkPerformance<T>(tag: string, asyncFn: () => Promise<T>): Promise<T> {
  const startTimestamp = Date.now();
  const result = await asyncFn();
  console.log();
  console.log(`\tPerformance Spec[${tag}]: ${(Date.now() - startTimestamp).toLocaleString()}ms`);
  console.log();
  return result;
}
