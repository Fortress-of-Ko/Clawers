export type YouTubeVideo = {
    id: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    channelTitle: string;
    publishedAt: string;
    viewCount?: string;
};

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

export async function getClawVideos(order: 'date' | 'viewCount' | 'relevance' = 'relevance', maxResults = 12): Promise<YouTubeVideo[]> {
    if (!YOUTUBE_API_KEY) {
        console.warn('YOUTUBE_API_KEY is not set. Returning empty array for videos.');
        return [];
    }

    try {
        // Query for top tips and strategies. 
        // We use keywords like "인형뽑기 공략", "인형뽑기 셋팅", "인형뽑기 꿀팁"
        const query = encodeURIComponent('인형뽑기|오락실|뽑기방|짱오락실|인형뽑기 브이로그|claw machine korea');

        // Next.js ISR: Cache the results for 6 hours (21600 seconds) to save API quota.
        // It will automatically re-fetch in the background after 6 hours.
        const res = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&order=${order}&maxResults=${maxResults}&regionCode=KR&relevanceLanguage=ko&key=${YOUTUBE_API_KEY}`,
            {
                next: { revalidate: 21600 },
                headers: {
                    'Referer': 'http://localhost:3000' // If testing locally with domain restrictions
                }
            }
        );

        if (!res.ok) {
            console.error('Failed to fetch YouTube videos', await res.text());
            return [];
        }

        const data = await res.json();
        const items = data.items || [];

        return items.map((item: any) => ({
            id: item.id.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
        }));
    } catch (e) {
        console.error('YouTube API error:', e);
        return [];
    }
}
