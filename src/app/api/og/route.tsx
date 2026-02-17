import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const user1 = searchParams.get('user1') || 'Dev';
    const user2 = searchParams.get('user2') || 'Dev';
    const score1 = searchParams.get('score1') || '?';
    const score2 = searchParams.get('score2') || '?';
    const winner = searchParams.get('winner') || 'none';

    // Fetch GitHub Avatars
    const avatar1 = `https://github.com/${user1}.png`;
    const avatar2 = `https://github.com/${user2}.png`;

    return new ImageResponse(
        (
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#09090b',
                    color: 'white',
                    fontFamily: 'sans-serif',
                }}
            >
                {/* Background Grid Effect */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'radial-gradient(circle at 25px 25px, #27272a 2%, transparent 0%), radial-gradient(circle at 75px 75px, #27272a 2%, transparent 0%)', backgroundSize: '100px 100px', opacity: 0.2, display: 'flex' }} />

                {/* Title */}
                <div style={{ display: 'flex', fontSize: 60, fontWeight: 900, marginBottom: 40, color: '#facc15' }}>
                    DevDuel ⚔️
                </div>

                {/* Battle Arena */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 60 }}>

                    {/* User 1 Card */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', border: winner === 'user1' ? '4px solid #facc15' : '4px solid #3f3f46', borderRadius: 20, padding: 20, backgroundColor: '#18181b' }}>
                        <img src={avatar1} width="140" height="140" style={{ borderRadius: 100, marginBottom: 20 }} />
                        <div style={{ fontSize: 32, fontWeight: 700 }}>{user1}</div>
                        <div style={{ fontSize: 64, fontWeight: 900, color: winner === 'user1' ? '#facc15' : '#e4e4e7' }}>{score1}</div>
                    </div>

                    {/* VS Badge */}
                    <div style={{ display: 'flex', fontSize: 48, fontWeight: 900, color: '#52525b' }}>VS</div>

                    {/* User 2 Card */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', border: winner === 'user2' ? '4px solid #facc15' : '4px solid #3f3f46', borderRadius: 20, padding: 20, backgroundColor: '#18181b' }}>
                        <img src={avatar2} width="140" height="140" style={{ borderRadius: 100, marginBottom: 20 }} />
                        <div style={{ fontSize: 32, fontWeight: 700 }}>{user2}</div>
                        <div style={{ fontSize: 64, fontWeight: 900, color: winner === 'user2' ? '#facc15' : '#e4e4e7' }}>{score2}</div>
                    </div>
                </div>
            </div>
        ),
        {
            width: 1200,
            height: 630,
        }
    );
}
