import { prisma } from '@/lib/prisma';
import Link from 'next/link';
export const revalidate = 0; // Disable cache for real-time updates

export default async function LeaderboardPage() {
    const battles = await prisma.battle.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20
    });

    return (
        <div className="max-w-5xl mx-auto p-8 text-zinc-100">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-4xl font-black text-yellow-400">⚔️ Global Battle Arena</h1>
                <Link href="/compare" className="px-6 py-2 bg-zinc-100 text-zinc-900 font-bold rounded hover:bg-zinc-300 transition">
                    + Start New Battle
                </Link>
            </div>

            <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/50">
                <table className="w-full text-left">
                    <thead className="bg-zinc-950 text-zinc-500 uppercase text-xs tracking-wider">
                        <tr>
                            <th className="p-4">Winner</th>
                            <th className="p-4">Loser</th>
                            <th className="p-4">Score</th>
                            <th className="p-4">Mode</th>
                            <th className="p-4 text-right">Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                        {battles.map((b) => (
                            <tr key={b.id} className="hover:bg-zinc-800/50 transition duration-150">
                                <td className="p-4 font-bold text-green-400">{b.winner}</td>
                                <td className="p-4 text-red-400 opacity-70">
                                    {b.winner === b.user1 ? b.user2 : b.user1}
                                </td>
                                <td className="p-4 font-mono font-bold text-yellow-100">
                                    {b.score1} - {b.score2}
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded ${b.persona === 'founder' ? 'bg-purple-900 text-purple-200' : 'bg-blue-900 text-blue-200'}`}>
                                        {b.persona}
                                    </span>
                                </td>
                                <td className="p-4 text-zinc-600 text-xs text-right font-mono">
                                    {new Date(b.createdAt).toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
