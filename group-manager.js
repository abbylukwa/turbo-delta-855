import asyncio
import os
import yt_dlp
import requests
from datetime import datetime, timedelta
import schedule
import time
import json
from typing import Dict, List
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GroupManager:
    def __init__(self):
        self.channels = {
            'music': 'https://whatsapp.com/channel/0029VbBn8li3LdQQcJbvwm2S',
            'entertainment': 'https://whatsapp.com/channel/0029Vb6GzqcId7nWURAdJv0M'
        }
        
        self.zim_comedians = [
            "Carl Joshua Ncube", "Doc Vikela", "Long John", "Clive Chigubu",
            "Q Dube", "Mai Titi", "Madam Boss", "Comic Pastor", 
            "King Kandoro", "Bhutisi"
        ]
        
        self.sa_comedians = [
            "Trevor Noah", "Loyiso Gola", "Skhumba Hlophe", "Tumi Morake",
            "David Kau", "Riaad Moosa", "Kagiso Lediga", "Celeste Ntuli",
            "Nik Rabinowitz", "Marc Lottering"
        ]
        
        self.saturday_shows = [
            "Wild 'N Out", "America's Got Talent", "The Masked Singer",
            "Lip Sync Battle", "So You Think You Can Dance", 
            "World of Dance", "The Voice"
        ]
        
        self.news_sources = [
            "BBC News Africa", "Al Jazeera English", "SABC News",
            "NTV Kenya", "Channels Television", "eNCA", "Africanews"
        ]
        
        self.music_schedule = {
            'Monday': [
                ('06:00-09:00', 'Acoustic'),
                ('09:00-12:00', 'Pop'),
                ('12:00-15:00', 'Afrobeat'),
                ('15:00-18:00', 'R&B/Soul'),
                ('18:00-22:00', 'Chill/Lo-fi')
            ],
            'Tuesday': [
                ('06:00-09:00', 'Jazz'),
                ('09:00-12:00', 'Dancehall'),
                ('12:00-15:00', 'Amapiano'),
                ('15:00-18:00', 'Hip-Hop'),
                ('18:00-22:00', 'Classical')
            ],
            'Wednesday': [
                ('06:00-09:00', 'Gospel'),
                ('09:00-12:00', 'Country'),
                ('12:00-15:00', 'Pop'),
                ('15:00-18:00', 'Trap'),
                ('18:00-22:00', 'Afro-soul')
            ],
            'Thursday': [
                ('06:00-09:00', 'Lo-fi'),
                ('09:00-12:00', 'K-Pop'),
                ('12:00-15:00', 'Afrobeat'),
                ('15:00-18:00', 'EDM'),
                ('18:00-22:00', 'R&B')
            ],
            'Friday': [
                ('06:00-09:00', 'House'),
                ('09:00-12:00', 'Hip-Hop'),
                ('12:00-15:00', 'Reggae'),
                ('15:00-18:00', 'Amapiano'),
                ('18:00-22:00', 'Party Mix')
            ],
            'Saturday': [
                ('06:00-09:00', 'Chillhop'),
                ('09:00-12:00', 'Afro-fusion'),
                ('12:00-15:00', 'ZimDancehall'),
                ('15:00-18:00', 'Gqom'),
                ('18:00-22:00', 'Dance/Electronic')
            ],
            'Sunday': [
                ('06:00-09:00', 'Worship'),
                ('09:00-12:00', 'Soft Rock'),
                ('12:00-15:00', 'Instrumentals'),
                ('15:00-18:00', 'Jazz'),
                ('18:00-22:00', 'Soul/Neo-Soul')
            ]
        }
        
        self.chart_sources = [
            "Billboard", "Spotify Charts", "Apple Music Top 100",
            "Shazam Global Top 200", "YouTube Music Trending"
        ]
        
        self.download_dir = Path("./downloads")
        self.download_dir.mkdir(exist_ok=True)
        
        # YouTube DL configuration
        self.ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': str(self.download_dir / '%(title)s.%(ext)s'),
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
        }
        
        self.video_ydl_opts = {
            'format': 'best[height<=720]',
            'outtmpl': str(self.download_dir / '%(title)s.%(ext)s'),
        }

    async def download_youtube_audio(self, url: str) -> str:
        """Download audio from YouTube and return file path"""
        try:
            with yt_dlp.YoutubeDL(self.ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                filename = ydl.prepare_filename(info)
                mp3_file = filename.rsplit('.', 1)[0] + '.mp3'
                return mp3_file
        except Exception as e:
            logger.error(f"Error downloading audio: {e}")
            return None

    async def download_youtube_video(self, url: str) -> str:
        """Download video from YouTube and return file path"""
        try:
            with yt_dlp.YoutubeDL(self.video_ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                return ydl.prepare_filename(info)
        except Exception as e:
            logger.error(f"Error downloading video: {e}")
            return None

    async def search_youtube(self, query: str, max_results: int = 5) -> List[str]:
        """Search YouTube for videos"""
        try:
            ydl_opts = {
                'quiet': True,
                'extract_flat': True,
                'force_json': True,
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                result = ydl.extract_info(f"ytsearch{max_results}:{query}", download=False)
                return [f"https://youtube.com/watch?v={entry['id']}" for entry in result['entries']]
        except Exception as e:
            logger.error(f"Error searching YouTube: {e}")
            return []

    async def post_to_channel(self, channel: str, content: str, file_path: str = None):
        """Simulate posting to WhatsApp channel"""
        try:
            logger.info(f"Posting to {channel}: {content}")
            if file_path:
                logger.info(f"With file: {file_path}")
            # Implementation for actual WhatsApp API would go here
            # This is a placeholder for the actual posting logic
            await asyncio.sleep(1)  # Simulate API call
        except Exception as e:
            logger.error(f"Error posting to channel: {e}")

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
            videos = await self.search_youtube(search_query, 3)
            
            for video_url in videos:
                # Download audio
                audio_file = await self.download_youtube_audio(video_url)
                if audio_file:
                    await self.post_to_channel(
                        'music', 
                        f"🎵 {current_genre} Track 🎵\n#Music #{
                            current_genre.replace('/', '')}",
                        audio_file
                    )
                
                # Download video (alternate between audio and video)
                if datetime.now().minute % 2 == 0:  # Every other post
                    video_file = await self.download_youtube_video(video_url)
                    if video_file:
                        await self.post_to_channel(
                            'music',
                            f"🎬 {current_genre} Video 🎬\n#MusicVideo #{
                                current_genre.replace('/', '')}",
                            video_file
                        )
                
                await asyncio.sleep(300)  # Wait 5 minutes between posts
                
        except Exception as e:
            logger.error(f"Error in music posting: {e}")

    async def post_comedian_content(self):
        """Post content from comedians"""
        try:
            all_comedians = self.zim_comedians + self.sa_comedians
            comedian = all_comedians[datetime.now().day % len(all_comedians)]
            
            # Search for comedian content
            search_queries = [
                f"{comedian} comedy latest",
                f"{comedian} funny clips",
                f"{comedian} standup"
            ]
            
            for query in search_queries:
                videos = await self.search_youtube(query, 2)
                for video_url in videos:
                    video_file = await self.download_youtube_video(video_url)
                    if video_file:
                        await self.post_to_channel(
                            'entertainment',
                            f"😂 {comedian} - Comedy Gold! 😂\n#Comedy #{
                                'ZimComedy' if comedian in self.zim_comedians else 'SAComedy'}",
                            video_file
                        )
                        await asyncio.sleep(1800)  # Wait 30 minutes
                        break
                
        except Exception as e:
            logger.error(f"Error posting comedian content: {e}")

    async def post_saturday_shows(self):
        """Post Saturday shows"""
        try:
            show = self.saturday_shows[datetime.now().weekday() % len(self.saturday_shows)]
            videos = await self.search_youtube(f"{show} full episode", 1)
            
            for video_url in videos:
                video_file = await self.download_youtube_video(video_url)
                if video_file:
                    await self.post_to_channel(
                        'entertainment',
                        f"📺 Saturday Special: {show} 📺\n#TVShow #WeekendEntertainment",
                        video_file
                    )
                    
        except Exception as e:
            logger.error(f"Error posting Saturday shows: {e}")

    async def post_hyping_quotes(self):
        """Post motivational quotes every 30 minutes"""
        try:
            quotes = [
                "🎉 Keep the energy high! 🎉",
                "🔥 Your daily dose of entertainment! 🔥",
                "🌟 Stay tuned for more amazing content! 🌟",
                "💫 Amazing things are coming your way! 💫",
                "🚀 Get ready for the next big thing! 🚀"
            ]
            
            quote = quotes[datetime.now().hour % len(quotes)]
            await self.post_to_channel('entertainment', quote)
            
        except Exception as e:
            logger.error(f"Error posting quotes: {e}")

    async def post_news(self):
        """Post news content from 7PM to 10PM"""
        try:
            news_source = self.news_sources[datetime.now().hour % len(self.news_sources)]
            videos = await self.search_youtube(f"{news_source} latest news Africa", 2)
            
            for video_url in videos:
                video_file = await self.download_youtube_video(video_url)
                if video_file:
                    await self.post_to_channel(
                        'entertainment',
                        f"📰 {news_source} - Latest Updates 📰\n#News #Africa #CurrentAffairs",
                        video_file
                    )
                    await asyncio.sleep(3600)  # Wait 1 hour between news posts
                    
        except Exception as e:
            logger.error(f"Error posting news: {e}")

    async def post_charts(self):
        """Post music charts at night"""
        try:
            chart_source = self.chart_sources[datetime.now().day % len(self.chart_sources)]
            search_query = f"{chart_source} top 10 this week"
            videos = await self.search_youtube(search_query, 3)
            
            for video_url in videos:
                video_file = await self.download_youtube_video(video_url)
                if video_file:
                    await self.post_to_channel(
                        'music',
                        f"🏆 {chart_source} - Top Charts 🏆\n#Charts #Top100 #MusicCharts",
                        video_file
                    )
                    await asyncio.sleep(300)  # Wait 5 minutes
                    
        except Exception as e:
            logger.error(f"Error posting charts: {e}")

    def schedule_tasks(self):
        """Schedule all automated tasks"""
        
        # Music channel scheduling
        schedule.every().day.at("06:00").do(
            lambda: asyncio.create_task(self.download_and_post_music())
        )
        schedule.every().day.at("12:00").do(
            lambda: asyncio.create_task(self.download_and_post_music())
        )
        schedule.every().day.at("18:00").do(
            lambda: asyncio.create_task(self.download_and_post_music())
        )
        
        # Entertainment channel scheduling
        schedule.every().day.at("12:00").do(
            lambda: asyncio.create_task(self.post_comedian_content())
        )
        schedule.every().day.at("20:00").do(
            lambda: asyncio.create_task(self.post_comedian_content())
        )
        
        # Saturday shows
        schedule.every().saturday.at("14:00").do(
            lambda: asyncio.create_task(self.post_saturday_shows())
        )
        
        # Hyping quotes every 30 minutes
        schedule.every(30).minutes.do(
            lambda: asyncio.create_task(self.post_hyping_quotes())
        )
        
        # News from 7PM to 10PM
        schedule.every().day.at("19:00").do(
            lambda: asyncio.create_task(self.post_news())
        )
        schedule.every().day.at("20:00").do(
            lambda: asyncio.create_task(self.post_news())
        )
        schedule.every().day.at("21:00").do(
            lambda: asyncio.create_task(self.post_news())
        )
        
        # Charts at night
        schedule.every().day.at("22:00").do(
            lambda: asyncio.create_task(self.post_charts())
        )

    async def run_scheduler(self):
        """Run the scheduler continuously"""
        while True:
            schedule.run_pending()
            await asyncio.sleep(1)

    async def start(self):
        """Start the group manager"""
        logger.info("Starting Group Manager...")
        self.schedule_tasks()
        await self.run_scheduler()

# Command handlers for manual control
class CommandHandler:
    def __init__(self, group_manager: GroupManager):
        self.gm = group_manager

    async def handle_command(self, command: str, channel: str):
        """Handle manual commands"""
        try:
            if command == "force_music_update":
                await self.gm.download_and_post_music()
            elif command == "force_comedian_post":
                await self.gm.post_comedian_content()
            elif command == "force_news":
                await self.gm.post_news()
            elif command == "force_charts":
                await self.gm.post_charts()
            elif command.startswith("download_"):
                url = command.replace("download_", "")
                if "youtube.com" in url or "youtu.be" in url:
                    file_path = await self.gm.download_youtube_audio(url)
                    if file_path:
                        await self.gm.post_to_channel(channel, "Downloaded content", file_path)
            elif command == "status":
                current_genre = await self.gm.get_current_genre()
                status_msg = f"Current Genre: {current_genre}\nActive Channels: {len(self.gm.channels)}"
                await self.gm.post_to_channel(channel, status_msg)
                
        except Exception as e:
            logger.error(f"Error handling command: {e}")

# Main execution
async def main():
    group_manager = GroupManager()
    command_handler = CommandHandler(group_manager)
    
    # Start the group manager
    await group_manager.start()

if __name__ == "__main__":
    # Install required packages: pip install yt-dlp schedule requests
    
    # Create necessary directories
    os.makedirs('./downloads', exist_ok=True)
    os.makedirs('./logs', exist_ok=True)
    
    # Run the bot
    asyncio.run(main())