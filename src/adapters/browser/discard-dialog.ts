export async function confirmDiscard(message: string): Promise<boolean> {
  return window.confirm(message);
}
