import React, { useState, useEffect } from 'react';
import { integrationsApi } from '../services/integrationsApi';
import { useAuth } from '../contexts/AuthContext';
import './LinkAtlassianBanner.css';

interface LinkAtlassianBannerProps {
    onLink: () => void;
}

export const LinkAtlassianBanner: React.FC<LinkAtlassianBannerProps> = ({ onLink }) => {
    const { accessToken } = useAuth();
    const [isLinked, setIsLinked] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        checkLinkStatus();
    }, [accessToken]); // Re-check when accessToken changes

    const checkLinkStatus = async () => {
        if (!accessToken) {
            setLoading(false);
            return;
        }

        try {
            const status = await integrationsApi.getAtlassianStatus(accessToken);
            setIsLinked(status.linked);
        } catch (error) {
            console.error('Error checking Atlassian status:', error);
        } finally {
            setLoading(false);
        }
    };

    // Don't show banner if loading, already linked, or dismissed
    if (loading || isLinked || isDismissed) return null;

    return (
        <div className="atlassian-banner">
            <div className="banner-content">
                <div className="banner-icon">🔗</div>
                <div className="banner-text">
                    <strong>Link your Atlassian account</strong>
                    <p>Connect Jira and Confluence to sync your projects and spaces</p>
                </div>
            </div>
            <div className="banner-actions">
                <button onClick={() => setIsDismissed(true)} className="btn-dismiss">
                    Dismiss
                </button>
                <button onClick={onLink} className="btn-link">
                    Link Account
                </button>
            </div>
        </div>
    );
};
