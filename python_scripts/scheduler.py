import logging
from datetime import datetime
from send_certificate import main as send_certificate_main

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def run_job():
    """
    Function that will be executed by Heroku Scheduler
    """
    try:
        logger.info(f"Starting scheduled task at {datetime.now()}")
        send_certificate_main()
        logger.info(f"Completed scheduled task at {datetime.now()}")
    except Exception as e:
        logger.error(f"Error in scheduled task: {str(e)}")

if __name__ == "__main__":
    run_job() 