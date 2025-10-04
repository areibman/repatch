This is an app called Repatch that uses LLMs to look at all the patch notes from a github repo (across 1 day, 1 week, 1 month) and creates a newsletter

Core features:
- Blog-style landing page with a grid of patch notes templates
- Each blog page is AI-generated based on changes that occured in the time period they cover
- Because the notes are AI-generated, the user can edit the patch notes and save them.
- There is an email list where the user can add/edit/remove recipient emails.
- On the main page, you can click to add a repo + time period to summarize the notes. This will be the process that creates the post.
- In the patch notes page, you can click a button that will send the patch notes as an email to all recipients in the list.

General rules:
- Use LiteLLM + AWS Bedrock for LLM summarization
- Use Resend for emails