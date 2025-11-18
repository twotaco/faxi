import axios from 'axios';

export class FaxDownloadService {
  /**
   * Download fax image from Telnyx media URL
   */
  async downloadFaxImage(mediaUrl: string): Promise<Buffer> {
    try {
      const response = await axios.get(mediaUrl, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 second timeout
      });

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error downloading fax image:', { mediaUrl, error });
      throw new Error(`Failed to download fax image: ${error}`);
    }
  }

  /**
   * Check if media URL is accessible
   */
  async checkMediaUrl(mediaUrl: string): Promise<boolean> {
    try {
      const response = await axios.head(mediaUrl, {
        timeout: 5000,
      });

      return response.status === 200;
    } catch (error) {
      console.error('Media URL check failed:', { mediaUrl, error });
      return false;
    }
  }
}

export const faxDownloadService = new FaxDownloadService();
