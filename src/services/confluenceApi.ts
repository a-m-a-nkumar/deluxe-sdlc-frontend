const CONFLUENCE_AUTH = 'Basic c2h1YmhhbS5zaW5naEBzaXJpdXNhaS5jb206QVRBVFQzeEZmR0YwX0ZsSkh5S3NHeVdzbDNnNEE3NWpFbTF3QlUzVThhNUo3VVp0cVJLcXEtajNCalJHNTdVRVUtNjJWRHhGMi0ta2NiUXp5R19DbUJ0a3c1STZkY1hPd0RkZHlmdE84SXZkMzBUOERaSG14NDNvTkpwUjdwek1jaGpUZ3d3WjBfRTBOSXk3NFdKRThaOHJzR21EUzhzemF4VU9SR2VfQWxnSWxHMFhrQk1JY1QwPThFNEM5RDhE';

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

export const fetchConfluencePages = async (): Promise<ConfluencePage[]> => {
  try {
    const response = await fetch(
      '/confluence-api/wiki/rest/api/content?spaceKey=SO&type=page&limit=100',
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': CONFLUENCE_AUTH,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch pages: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Error fetching Confluence pages:', error);
    throw error;
  }
};

export const fetchConfluencePageDetails = async (pageId: string): Promise<ConfluencePageDetails> => {
  try {
    const response = await fetch(
      `/confluence-api/wiki/rest/api/content/${pageId}?expand=body.storage%2Cversion%2Cancestors`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': CONFLUENCE_AUTH,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch page details: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
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

export const fetchConfluencePageByTitle = async (spaceKey: string, title: string): Promise<ConfluencePage | null> => {
  try {
    const encodedTitle = encodeURIComponent(title);
    const response = await fetch(
      `/confluence-api/wiki/rest/api/content?spaceKey=${spaceKey}&title=${encodedTitle}&expand=version`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': CONFLUENCE_AUTH,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch page by title: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results && data.results.length > 0 ? data.results[0] : null;
  } catch (error) {
    console.error('Error fetching Confluence page by title:', error);
    throw error;
  }
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

export const updateConfluencePage = async (pageData: UpdateConfluencePageRequest): Promise<any> => {
  try {
    const response = await fetch(
      `/confluence-api/wiki/rest/api/content/${pageData.id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': CONFLUENCE_AUTH,
        },
        body: JSON.stringify(pageData),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update page: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating Confluence page:', error);
    throw error;
  }
};

export const createConfluencePage = async (pageData: CreateConfluencePageRequest): Promise<any> => {
  try {
    const response = await fetch(
      '/confluence-api/wiki/rest/api/content/',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': CONFLUENCE_AUTH,
        },
        body: JSON.stringify(pageData),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create page: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating Confluence page:', error);
    throw error;
  }
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
