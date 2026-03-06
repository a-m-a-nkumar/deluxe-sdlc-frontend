export interface BRDSection {
    title: string;
    sectionNumber: number | null;
    description: string;
    content: string;
}

/**
 * Parses BRD markdown content into structured sections.
 * @param content The raw markdown content of the BRD
 * @returns Array of parsed BRD sections
 */
export const parseBRDSections = (content: string): BRDSection[] => {
    const sections: BRDSection[] = [];

    // Split content by markdown headers (##)
    const lines = content.split('\n');
    let currentSection: BRDSection | null = null;
    let currentContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check for markdown section headers (## Section Title or ## 1. Section Title)
        if (line.startsWith('## ')) {
            // Save previous section if it exists
            if (currentSection) {
                currentSection.content = currentContent.join('\n').trim();
                sections.push(currentSection);
            }

            // Extract section number and title
            const headerMatch = line.match(/^##\s*(\d+)\.?\s*(.+)$/);
            let sectionNumber: number | null = null;
            let title: string;

            if (headerMatch) {
                // Has number: "## 1. Purpose" or "## 1 Purpose"
                sectionNumber = parseInt(headerMatch[1], 10);
                title = headerMatch[2].trim();
            } else {
                // No number: "## Purpose"
                title = line.replace(/^##\s*/, '').trim();
                // Try to infer number from position (first section = 1, etc.)
                sectionNumber = sections.length + 1;
            }

            currentSection = {
                title,
                sectionNumber,
                description: '',
                content: ''
            };
            currentContent = [];
        } else if (currentSection && line) {
            // Add content to current section
            currentContent.push(line);

            // Use first non-empty line as description if not set
            if (!currentSection.description && line.length > 0 && !line.startsWith('#')) {
                currentSection.description = line.length > 80 ? line.substring(0, 80) + '...' : line;
            }
        }
    }

    // Don't forget to add the last section
    if (currentSection) {
        // @ts-ignore - we know currentSection is not null here
        currentSection.content = currentContent.join('\n').trim();
        sections.push(currentSection);
    }

    // If no sections found in markdown format, return empty array
    // (Document Overview will still show as it's independent)
    return sections;
};
