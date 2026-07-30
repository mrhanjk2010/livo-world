import { ChatRouteBody } from "@/components/chat/chat-route-body";
import { PhoneFrame } from "@/components/mobile/phone-frame";
import { chatLocationParams } from "@/lib/chat-locations";

export function generateStaticParams() {
  return chatLocationParams();
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ location: string }>;
}) {
  const { location: raw } = await params;
  const location = decodeURIComponent(raw);

  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-neutral-950 md:p-8">
      <PhoneFrame dataNodeId="1571:5101" dataName="日常事件">
        <ChatRouteBody location={location} mode="event" />
      </PhoneFrame>
    </main>
  );
}
