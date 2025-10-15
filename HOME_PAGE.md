# Home Page - Grid View

## Overview
The home page displays a responsive grid of all patch note posts, providing an overview of AI-generated content from various repositories.

## Location
`/app/page.tsx`

## Features

### 1. **Header Section**
- **Branding**: "Repatch" title with tagline
- **Create Button**: "Create New Post" button to add new repositories/patch notes
- **Sticky Navigation**: Header stays visible while scrolling

### 2. **Statistics Dashboard**
- **Total Posts**: Count of all patch notes
- **Repositories**: Number of unique repositories being tracked
- **This Month**: Posts generated in the current month

### 3. **Patch Notes Grid**
- **Responsive Layout**: 
  - 1 column on mobile
  - 2 columns on medium screens (md)
  - 3 columns on large screens (lg)
- **Card Interactions**: Hover effects with subtle scale and shadow
- **Click to View**: Entire card is clickable, linking to the full blog post

### 4. **Individual Post Cards**

Each card displays:

#### Header
- **Time Period Badge**: Color-coded badges for Daily/Weekly/Monthly
  - Daily: Blue
  - Weekly: Green  
  - Monthly: Purple
- **Date**: When the patch note was generated

#### Content
- **Title**: Clickable title with hover effect
- **Repository**: GitHub repository name with icon
- **Preview**: First 3 lines of content
- **Change Statistics**: Visual breakdown of:
  - Lines added (green)
  - Lines modified (blue)
  - Lines removed (red)
- **GitHub Status**: Badge summarizing publish state with release/discussion indicators

#### Footer
- **Contributors**: Number of contributors
- **Read More Link**: Hover-underlined link

### 5. **Empty State**
- Shown when no patch notes exist
- Centered message with icon
- Call-to-action button to create first post

### 6. **Footer**
- Simple footer with branding

## Design Features

### Visual Design
- **Gradient Background**: Subtle gradient from background to muted
- **Card Hover Effects**: 
  - Shadow increases
  - Slight scale (1.02x)
  - Title color changes to primary
- **Color Coding**: Consistent color scheme for different data types
- **Responsive Typography**: Scales appropriately for screen size

### Accessibility
- Semantic HTML structure
- Keyboard navigation support (links are focusable)
- Color contrast meets WCAG standards
- Screen reader friendly labels

## Components Used

### ShadCN UI
- `Button` - Create new post action
- `Card`, `CardContent`, `CardDescription`, `CardFooter`, `CardHeader`, `CardTitle` - Post cards
- `Badge` - Time period labels

### Icons (lucide-react)
- `PlusIcon` - Create new post
- `GitBranchIcon` - Repository indicator
- `CalendarIcon` - Date indicator
- `UsersIcon` - Contributors indicator
- `GithubIcon` - GitHub publishing status badges

## Data Flow

```typescript
// Mock data currently used
const getMockPatchNotes = (): PatchNote[]

// In production, replace with:
const fetchPatchNotes = async () => {
  const response = await fetch('/api/patch-notes');
  return response.json();
}
```

## Styling

- Tailwind CSS for all styling
- Custom color utilities for time period badges
- Responsive grid system
- Dark mode support through CSS variables
- Hover and focus states for interactive elements

## TODO: Implementation

1. **Create Post Modal/Page**
   - Add modal or route for creating new patch notes
   - Form to input: repository URL, time period
   - Trigger AI generation

2. **API Integration**
   - Replace `getMockPatchNotes()` with actual API
   - Endpoint: `GET /api/patch-notes`
   - Add pagination if needed for large datasets

3. **Filtering/Sorting**
   - Add filter by repository
   - Add filter by time period
   - Sort by date, popularity, etc.

4. **Search**
   - Add search bar to filter posts by title/content
   - Implement client-side or server-side search

5. **Infinite Scroll or Pagination**
   - For better performance with many posts
   - Load more posts as user scrolls

## Link Structure

- Each card links to: `/blog/[id]`
- Example: clicking a card with ID "1" navigates to `/blog/1`

## Performance Considerations

- Uses Next.js Link component for optimized navigation
- Client-side rendering for interactive features
- Efficient grid layout with CSS Grid
- Minimal re-renders with proper React patterns

## Mobile Experience

- Fully responsive design
- Single column layout on mobile
- Touch-friendly tap targets (entire card clickable)
- Optimized spacing for smaller screens
- Readable typography at all sizes

