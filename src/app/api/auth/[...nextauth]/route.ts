import NextAuth from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

const handler = NextAuth({
    adapter: PrismaAdapter(prisma),
    providers: [
        GithubProvider({
            clientId: process.env.GITHUB_ID as string,
            clientSecret: process.env.GITHUB_SECRET as string,
            profile(profile) {
                return {
                    id: profile.id.toString(),
                    name: profile.name || profile.login,
                    email: profile.email,
                    image: profile.avatar_url,
                    username: profile.login, // GitHub handle
                };
            },
        }),
    ],
    callbacks: {
        session: async ({ session, user }) => {
            if (session?.user) {
                session.user.id = user.id;
                // @ts-expect-error — username is added via extended User model
                session.user.username = user.username;
            }
            return session;
        },
    },
});

export { handler as GET, handler as POST };
