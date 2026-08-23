import { denyUnlessCraneRead, withDoor } from "@/lib/yard/door";
import { containerLogsBuffer, containerLogsFollow, dockerErrorMessage } from "@/lib/yard/host/docker";
import { getGantry } from "@/lib/yard/crane/inventory";
import { createLogDemuxer, decodeDockerLogs, parseLogLine, parseLogText, splitLogLines } from "@/lib/yard/host/logs";

export const dynamic = "force-dynamic";

export const GET = withDoor(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const denied = denyUnlessCraneRead(req, slug);
  if (denied) {
    return denied;
  }
  const g = await getGantry(slug);
  if (!g?.containerId) {
    return Response.json({ error: g ? "no container attached" : "not found" }, { status: 404 });
  }
  const url = new URL(req.url);
  const follow = url.searchParams.get("follow") === "1";
  const tail = Number(url.searchParams.get("tail") ?? "200");
  const n = Number.isFinite(tail) && tail >= 0 ? Math.min(tail, 2000) : 200;

  if (!follow) {
    try {
      const buf = await containerLogsBuffer(g.containerId, n);
      return Response.json({ lines: parseLogText(decodeDockerLogs(buf)) });
    } catch (err) {
      return Response.json({ error: dockerErrorMessage(err) }, { status: 500 });
    }
  }

  let stream: NodeJS.ReadableStream;
  try {
    stream = await containerLogsFollow(g.containerId, n);
  } catch (err) {
    return Response.json({ error: dockerErrorMessage(err) }, { status: 500 });
  }

  const demux = createLogDemuxer();
  const encoder = new TextEncoder();
  let rest = "";
  const readable = new ReadableStream({
    start(controller) {
      const send = (chunk: Uint8Array) => {
        const { lines, rest: next } = splitLogLines(rest, demux.push(chunk));
        rest = next;
        for (const raw of lines) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(parseLogLine(raw))}\n\n`));
        }
      };
      stream.on("data", (d: Buffer) => send(d));
      stream.on("end", () => controller.close());
      stream.on("error", (err: Error) => controller.error(err));
      req.signal.addEventListener("abort", () => {
        (stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
      });
    },
    cancel() {
      (stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});
