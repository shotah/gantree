import { denyUnlessAdmin, withDoor } from "@/lib/yard/door";
import { containerLogsBuffer, containerLogsFollow, dockerErrorMessage, findConsoleWorkload } from "@/lib/yard/host/docker";
import { createLogDemuxer, decodeDockerLogs, parseLogLine, parseLogText, splitLogLines } from "@/lib/yard/host/logs";

export const dynamic = "force-dynamic";

export const GET = withDoor(async (req: Request) => {
  const denied = denyUnlessAdmin(req);
  if (denied) {
    return denied;
  }
  let box: Awaited<ReturnType<typeof findConsoleWorkload>>;
  try {
    box = await findConsoleWorkload();
  } catch (err) {
    return Response.json({ error: dockerErrorMessage(err) }, { status: 500 });
  }
  if (!box) {
    return Response.json({ error: "console is this process — no gantree container to tail" }, { status: 404 });
  }
  const url = new URL(req.url);
  const follow = url.searchParams.get("follow") === "1";
  const tail = Number(url.searchParams.get("tail") ?? "200");
  const n = Number.isFinite(tail) && tail >= 0 ? Math.min(tail, 2000) : 200;

  if (!follow) {
    try {
      const buf = await containerLogsBuffer(box.id, n);
      return Response.json({ lines: parseLogText(decodeDockerLogs(buf)), name: box.name });
    } catch (err) {
      return Response.json({ error: dockerErrorMessage(err) }, { status: 500 });
    }
  }

  let stream: NodeJS.ReadableStream;
  try {
    stream = await containerLogsFollow(box.id, n);
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
