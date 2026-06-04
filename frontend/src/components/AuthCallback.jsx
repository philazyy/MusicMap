import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function AuthCallback({ onLoginSuccess }) {
  useEffect(() => {
    // Parse parameters from query string
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userId = params.get('userId');
    const displayName = params.get('displayName');
    const profileImage = params.get('profileImage');
    const isPremium = params.get('isPremium') === '1';

    if (token && userId) {
      // Save credentials to localStorage
      localStorage.setItem('musicmap_token', token);
      localStorage.setItem('musicmap_userId', userId);
      localStorage.setItem('musicmap_displayName', displayName || userId);
      localStorage.setItem('musicmap_profileImage', profileImage || '');
      localStorage.setItem('musicmap_isPremium', isPremium ? '1' : '0');

      // Trigger App login state update
      onLoginSuccess({
        token,
        userId,
        displayName: displayName || userId,
        profileImage: profileImage || '',
        isPremium
      });
    } else {
      console.error('Missing auth credentials in redirect URL');
      // Go back to login
      window.location.href = '/';
    }
  }, [onLoginSuccess]);

  return (
    <div className="min-h-screen flex flex-col justify-center items-center gap-4 bg-dark-900 text-white">
      <Loader2 className="w-12 h-12 text-spotify animate-spin shadow-glow-spotify rounded-full" />
      <div className="text-center">
        <h2 className="text-xl font-bold mb-1">Authenticating with Spotify</h2>
        <p className="text-sm text-white/50">Fetching your profile and syncing session keys...</p>
      </div>
    </div>
  );
}
