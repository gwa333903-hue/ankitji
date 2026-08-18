// File: api/upload.js

// NEW: Increase the body size limit to prevent 413 Payload Too Large errors
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', // Adjust this size limit as needed for your application
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { filename, originalName, content } = req.body;
  
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_USERNAME = "gwa333903-hue";
  const GITHUB_REPO = "class";

  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filename}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Vercel-Serverless-Function'
      },
      body: JSON.stringify({
        message: `Admin uploaded class note: ${originalName}`,
        content: content
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to upload to GitHub');
    }

    // Pass the GitHub download URL back to your frontend so Firebase can save it
    res.status(200).json({ 
      success: true, 
      fileUrl: data.content.download_url 
    });

  } catch (error) {
    console.error("Backend Error:", error);
    res.status(500).json({ error: error.message });
  }
}