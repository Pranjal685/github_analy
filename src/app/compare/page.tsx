import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import CompareClient from "./compare-client";

type Props = {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
    const params = await searchParams;
    const user1 = (params.user1 as string) || "Challenger 1";
    const user2 = (params.user2 as string) || "Challenger 2";
    const score1 = (params.score1 as string) || "";
    const score2 = (params.score2 as string) || "";
    const winner = (params.winner as string) || "none";

    // Construct the OG Image URL
    const ogUrl = new URL(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/og`
    );
    ogUrl.searchParams.set("user1", user1);
    ogUrl.searchParams.set("user2", user2);
    ogUrl.searchParams.set("score1", score1);
    ogUrl.searchParams.set("score2", score2);
    ogUrl.searchParams.set("winner", winner);

    return {
        title: `${user1} vs ${user2} | DevDuel`,
        description: `See who wins the battle between ${user1} and ${user2}.`,
        openGraph: {
            images: [
                {
                    url: ogUrl.toString(),
                    width: 1200,
                    height: 630,
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
        },
    };
}

export default async function ComparePage() {
    const session = await getServerSession();
    const username = (session?.user as any)?.username || "";
    return <CompareClient lockedUser={username} />;
}
