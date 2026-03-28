// src/components/ui/ComponentRegistry.md

# UI Component Registry

This document tracks existing UI components to prevent duplication.

## Layout
- MainLayout - Main application layout with top navigation
- MainContent - Content container with responsive padding
- TopNav - Top navigation bar with mobile responsiveness

## Navigation
- NavLink - Navigation link for desktop navigation
- MobileNavLink - Navigation link for mobile menu
- UserMenu - User dropdown menu

## User
- Avatar - User avatar with initials and color generation

## Feedback
- LoadingSpinner - Loading indicator with size variants

## When to add components
Before creating a new component, check this registry. If a component with similar 
functionality exists, consider extending it rather than creating a new one.

## Naming conventions
- Use PascalCase for component names
- Group by function (layout, navigation, feedback, data, etc.)
- Use consistent prop patterns across similar components