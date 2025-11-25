import { action } from './_generated/server'
import { v } from 'convex/values'
import Anthropic from '@anthropic-ai/sdk'
import { api } from './_generated/api'

function parseClaudeJsonResponse(response: any) {
  let text = response.content[0].text.trim();
  
  // Find the first { and last }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('No JSON object found in response');
  }
  
  // Extract only the JSON portion
  const jsonString = text.substring(firstBrace, lastBrace + 1);
  
  return JSON.parse(jsonString);
}

export const generatePageContent = action({
  args: {
    prompt: v.string(),
    companyId: v.id('companies'),
  },
  handler: async (ctx, args) => {
    const company = await ctx.runQuery(api.companies.getCompany, {
      companyId: args.companyId,
    })

    const companyContext = company?.companyBrief
      ? `\n\nCompany Context: ${company.companyBrief}`
      : ''

    const systemPrompt = `
    <role>
    
      You're an SEO/AEO content writer for ${company?.name} (${company?.domain})

      </role>
      <goal>
        Write in a friendly, conversational tone that's easy to read while strategically structured for maximum visibility.
      </goal>
      <instructions>
      ##Writing Style

* Conversational and warm, like talking to a knowledgeable friend
* Clear, accessible language (7th-9th grade reading level)
* Front-load key information in first 100-150 words
* Mix short punchy sentences with longer detailed ones
* Keep paragraphs to 2-4 sentences max
* 

## Heading Structure
H1: One per page, 40-70 characters, includes primary keyword
H2: Major sections (4-8 per article), use questions when possible for featured snippets
H3: Break H2s into 150-300 word chunks, use for steps or specific points
H4-H6: Rarely; only for deep hierarchy
Never skip heading levels. Maintain logical nesting.

## Word count targets
800 words

      </instructions>

      <context>
      I'm now going to provide you with the company's brand brief
      
      <brief>
      ${companyContext}
      </brief>
      </context>
      <output>
      
**Required JSON Structure:**

{
  "h1": "string (primary H1 headline for the page)",
  "pageTitle": "string (SEO title tag, 50-60 characters)",
  "pageDescription": "string (meta description, 150-160 characters)",
  "slug": "string (URL-friendly slug, lowercase with hyphens)",
  "markdownContent": "string (complete article content in markdown format with proper heading hierarchy, lists, tables, links, and formatting)"
}


**Critical JSON Rules:**
- DO NOT include markdown code fences (no \`\`\`json or \`\`\`)
- DO NOT include any text before or after the JSON object
- DO NOT add explanatory comments
- ALL strings must use double quotes, not single quotes
- The \`markdownContent\` field must contain the full article with proper markdown syntax including ##, ###, -, *, [links](), etc.
- Use \\n for line breaks within the \`markdownContent\` string
- Escape special characters: use \\" for quotes, \\\\ for backslashes within strings
- Ensure all brackets and braces are properly closed

**If you output anything other than valid, parseable JSON, the system will fail.**
      </output>
    `

    // Initialize the Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: args.prompt,
        },
      ],
    }) as any


    const output = parseClaudeJsonResponse(response)
console.log('response', response, output)

    // const content = response?.content?.[0]
    // if (content?.type !== 'text') {
    //   throw new Error('Failed to generate content')
    // }

    return output// JSON.parse(content.text)
  },
})
