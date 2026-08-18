// File: api/github.js

export default async function handler(req, res) {
  try {
    // Fetching from your specific GitHub username
    const response = await fetch('https://api.github.com/users/gwa333903-hue', {
      headers: {
        // Vercel will safely swap process.env.GITHUB_TOKEN with the secret you put in their dashboard
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Vercel-Serverless-Function' 
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API Error: ${response.status}`);
    }

    const data = await response.json();
    
    // Send the data safely back to your website
    res.status(200).json(data);
    
  } catch (error) {
    console.error("Backend Error:", error);
    res.status(500).json({ error: 'Failed to fetch data from GitHub' });
  }
}