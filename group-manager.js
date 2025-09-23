import sys
import os
sys.path.append('/app/python_deps')

from dependencies import *
import asyncio
from datetime import datetime

class GroupManager:
    def __init__(self):
        self.channels = CHANNELS
        self.zim_comedians = ZIM_COMEDIANS
        self.sa_comedians = SA_COMEDIANS
        self.saturday_shows = SATURDAY_SHOWS
        self.news_sources = NEWS_SOURCES
        self.music_schedule = MUSIC_SCHEDULE
        self.chart_sources = CHART_SOURCES
        self.hyping_quotes = HYPING_QUOTES
        
        self.download_dir = Path("./downloads")
        self.download_dir.mkdir(exist_ok=True)
        
        self.ydl_audio_opts = get_ydl_audio_opts(self.download_dir)
        self.ydl_video_opts = get_ydl_video_opts(self.download_dir)

    async def download_youtube_audio(self, url: str) -> str:
        """Download audio from YouTube and return file path"""
        try:
            with yt_dlp.YoutubeDL(self.ydl_audio_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                filename = ydl.prepare_filename(info)
                mp3_file = filename.rsplit('.', 1)[0] + '.mp3'
                return mp3_file
        except Exception as e:
            logging.error(f"Error downloading audio: {e}")
            return None

    async def download_youtube_video(self, url: str) -> str:
        """Download video from YouTube and return file path"""
        try:
            with yt_dlp.YoutubeDL(self.ydl_video_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                return ydl.prepare_filename(info)
        except Exception as e:
            logging.error(f"Error downloading video: {e}")
            return None

    async def search_youtube(self, query: str, max_results: int = 5) -> List[str]:
        """Search YouTube for videos"""
        try:
            ydl_opts = {
                'quiet': True,
                'extract_flat': True,
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                result = ydl.extract_info(f"ytsearch{max_results}:{query}", download=False)
                return [f"https://youtube.com/watch?v={entry['id']}" for entry in result['entries']]
        except Exception as e:
            logging.error(f"Error searching YouTube: {e}")
            return []

    async def post_to_channel(self, channel: str, content: str, file_path: str = None):
        """Simulate posting to WhatsApp channel"""
        try:
            logging.info(f"Posting to {channel}: {content}")
            if file_path:
                logging.info(f"With file: {file_path}")
            await asyncio.sleep(1)
        except Exception as e:
            logging.error(f"Error posting to channel: {e}")

    async def get_current_genre(self) -> str:
        """Get current music genre based on schedule"""
        now = datetime.now()
        current_day = now.strftime('%A')
        current_time = now.strftime('%H:%M')
        
        for time_range, genre in self.music_schedule[current_day]:
            start_time, end_time = time_range.split('-')
            if start_time <= current_time <= end_time:
                return genre
        return None

    async def download_and_post_music(self):
        """Download and post music based on current genre"""
        try:
            current_genre = await self.get_current_genre()
            if not current_genre:
                return
            
            search_query = f"{current_genre} 2024 latest hits"
            videos = await self.search_youtube(search_query, 2)
            
            for video_url in videos:
                audio_file = await self.download_youtube_audio(video_url)
                if audio_file:
                    await self.post_to_channel(
                        'music', 
                        f"🎵 {current_genre} Track 🎵",
                        audio_file
                    )
                    await asyncio.sleep(300)
                
        except Exception as e:
            logging.error(f"Error in music posting: {e}")

    async def post_comedian_content(self):
        """Post content from comedians"""
        try:
            all_comedians = self.zim_comedians + self.sa_comedians
            comedian = all_comedians[datetime.now().day % len(all_comedians)]
            
            videos = await self.search_youtube(f"{comedian} comedy", 1)
            for video_url in videos:
                video_file = await self.download_youtube_video(video_url)
                if video_file:
                    await self.post_to_channel(
                        'entertainment',
                        f"😂 {comedian} - Comedy Gold! 😂",
                        video_file
                    )
                    break
                
        except Exception as e:
            logging.error(f"Error posting comedian content: {e}")

    async def post_saturday_shows(self):
        """Post Saturday shows"""
        try:
            if datetime.now().strftime('%A') == 'Saturday':
                show = self.saturday_shows[datetime.now().weekday() % len(self.saturday_shows)]
                videos = await self.search_youtube(f"{show} highlights", 1)
                
                for video_url in videos:
                    video_file = await self.download_youtube_video(video_url)
                    if video_file:
                        await self.post_to_channel(
                            'entertainment',
                            f"📺 Saturday Special: {show} 📺",
                            video_file
                        )
                        
        except Exception as e:
            logging.error(f"Error posting Saturday shows: {e}")

    async def post_hyping_quotes(self):
        """Post motivational quotes"""
        try:
            quote = self.hyping_quotes[datetime.now().hour % len(self.hyping_quotes)]
            await self.post_to_channel('entertainment', quote)
            
        except Exception as e:
            logging.error(f"Error posting quotes: {e}")

    async def post_news(self):
        """Post news content from 7PM to 10PM"""
        try:
            current_hour = datetime.now().hour
            if 19 <= current_hour <= 22:  # 7PM to 10PM
                news_source = self.news_sources[current_hour % len(self.news_sources)]
                videos = await self.search_youtube(f"{news_source} Africa news", 1)
                
                for video_url in videos:
                    video_file = await self.download_youtube_video(video_url)
                    if video_file:
                        await self.post_to_channel(
                            'entertainment',
                            f"📰 {news_source} - Latest Updates 📰",
                            video_file
                        )
                    
        except Exception as e:
            logging.error(f"Error posting news: {e}")

    async def post_charts(self):
        """Post music charts at night"""
        try:
            if datetime.now().hour >= 22:  # After 10PM
                chart_source = self.chart_sources[datetime.now().day % len(self.chart_sources)]
                videos = await self.search_youtube(f"{chart_source} top 10", 1)
                
                for video_url in videos:
                    video_file = await self.download_youtube_video(video_url)
                    if video_file:
                        await self.post_to_channel(
                            'music',
                            f"🏆 {chart_source} - Top Charts 🏆",
                            video_file
                        )
                    
        except Exception as e:
            logging.error(f"Error posting charts: {e}")

    def schedule_tasks(self):
        """Schedule all automated tasks"""
        schedule.every(30).minutes.do(lambda: asyncio.create_task(self.post_hyping_quotes()))
        schedule.every().hour.do(lambda: asyncio.create_task(self.download_and_post_music()))
        schedule.every().day.at("12:00").do(lambda: asyncio.create_task(self.post_comedian_content()))
        schedule.every().day.at("20:00").do(lambda: asyncio.create_task(self.post_comedian_content()))
        schedule.every().day.at("19:00").do(lambda: asyncio.create_task(self.post_news()))
        schedule.every().day.at("22:00").do(lambda: asyncio.create_task(self.post_charts()))
        schedule.every().saturday.at("14:00").do(lambda: asyncio.create_task(self.post_saturday_shows()))

    async def run_scheduler(self):
        """Run the scheduler continuously"""
        while True:
            schedule.run_pending()
            await asyncio.sleep(60)  # Check every minute

    async def start(self):
        """Start the group manager"""
        logging.info("Starting Group Manager...")
        self.schedule_tasks()
        await self.run_scheduler()

# Main execution
async def main():
    group_manager = GroupManager()
    await group_manager.start()

if __name__ == "__main__":
    asyncio.run(main())