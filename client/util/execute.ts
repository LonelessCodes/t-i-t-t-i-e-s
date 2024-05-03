export async function execute(cmd: string, args: string[]) {
  try {
    const ps = new Deno.Command(cmd, {
      args: args,
    });
    const output = await ps.output();

    return output.success;
  } catch {
    return false;
  }
}
