import { API_CONFIG } from '@/config/api';

const BASE_URL = API_CONFIG.BASE_URL;

/** @deprecated Legacy hardcoded auth removed. All Confluence operations now go through the authenticated backend. */

export interface ConfluencePage {
  id: string;
  type: string;
  status: string;
  title: string;
  _links: {
    webui: string;
    self: string;
  };
}

export interface ConfluencePageDetails {
  id: string;
  type: string;
  status: string;
  title: string;
  body: {
    storage: {
      value: string;
      representation: string;
    };
  };
  version: {
    by: {
      displayName: string;
      email?: string;
    };
    when: string;
    number: number;
  };
  ancestors?: Array<{
    id: string;
    title: string;
  }>;
  _links: {
    webui: string;
  };
}

/** Fetch Confluence pages using current user's linked Atlassian account (via backend). Requires Bearer token. */
export const fetchConfluencePages = async (token: string, spaceKey: string = 'SO'): Promise<ConfluencePage[]> => {
  if (!token) throw new Error('Authentication required');
  try {
    const url = `${BASE_URL}/api/integrations/confluence/pages?space_key=${encodeURIComponent(spaceKey)}&limit=100`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to fetch pages: ${response.statusText}`);
    }
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Error fetching Confluence pages:', error);
    throw error;
  }
};

/** Fetch Confluence page details using current user's linked Atlassian account (via backend). Requires Bearer token. */
export const fetchConfluencePageDetails = async (pageId: string, token: string): Promise<ConfluencePageDetails> => {
  if (!token) throw new Error('Authentication required');
  try {
    const expand = 'body.storage,version,ancestors';
    const url = `${BASE_URL}/api/integrations/confluence/pages/${pageId}?expand=${encodeURIComponent(expand)}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to fetch page details: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching Confluence page details:', error);
    throw error;
  }
};

export interface CreateConfluencePageRequest {
  type: string;
  title: string;
  ancestors: Array<{ id: number }>;
  space: { key: string };
  body: {
    storage: {
      value: string;
      representation: string;
    };
  };
}

/** @deprecated Use backend endpoint instead. This function relied on removed hardcoded credentials. */
export const fetchConfluencePageByTitle = async (spaceKey: string, title: string): Promise<ConfluencePage | null> => {
  console.warn('fetchConfluencePageByTitle is deprecated. Use backend endpoint /api/integrations/confluence/pages instead.');
  throw new Error('Legacy Confluence API function removed. Use backend endpoint instead.');
};


export interface UpdateConfluencePageRequest {
  id: string;
  type: string;
  title: string;
  version: {
    number: number;
  };
  body: {
    storage: {
      value: string;
      representation: string;
    };
  };
}

/** @deprecated Use backend endpoint instead. This function relied on removed hardcoded credentials. */
export const updateConfluencePage = async (pageData: UpdateConfluencePageRequest): Promise<any> => {
  console.warn('updateConfluencePage is deprecated. Use backend endpoint instead.');
  throw new Error('Legacy Confluence API function removed. Use backend endpoint instead.');
};


/** @deprecated Use backend endpoint /api/integrations/confluence/upload-brd instead. This function relied on removed hardcoded credentials. */
export const createConfluencePage = async (pageData: CreateConfluencePageRequest): Promise<any> => {
  console.warn('createConfluencePage is deprecated. Use backend endpoint /api/integrations/confluence/upload-brd instead.');
  throw new Error('Legacy Confluence API function removed. Use backend endpoint instead.');
};


export const createOrUpdateConfluencePage = async (
  spaceKey: string,
  title: string,
  content: string,
  ancestorId?: number
): Promise<any> => {
  try {
    // Check if page already exists
    const existingPage = await fetchConfluencePageByTitle(spaceKey, title);

    if (existingPage) {
      // Update existing page
      const updateData: UpdateConfluencePageRequest = {
        id: existingPage.id,
        type: 'page',
        title: title,
        version: {
          number: (existingPage as any).version.number + 1,
        },
        body: {
          storage: {
            value: content,
            representation: 'storage',
          },
        },
      };
      return await updateConfluencePage(updateData);
    } else {
      // Create new page
      const createData: CreateConfluencePageRequest = {
        type: 'page',
        title: title,
        ancestors: ancestorId ? [{ id: ancestorId }] : [],
        space: { key: spaceKey },
        body: {
          storage: {
            value: content,
            representation: 'storage',
          },
        },
      };
      return await createConfluencePage(createData);
    }
  } catch (error) {
    console.error('Error creating or updating Confluence page:', error);
    throw error;
  }
};
