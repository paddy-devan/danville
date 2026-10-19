## Scope

- Develop a browser-based 2D game using Phaser 4, TypeScript and Vite.
- Host the game on Cloudflare Workers, with all gameplay running client-side.
- Prioritise rapid development and playtesting, with small, playable increments.

## Conversation style

- Use conversations as an opportunity to discuss the advantages and disadvantages of different approaches. Explain decisions in the context of broader concepts in game development, DevOps and general computing.
- Use clear, accessible language to help users develop their understanding of software development. Explain the reasoning behind important technical decisions rather than simply presenting solutions.
- Think critically about feature requests rather than agreeing automatically. Consider feasibility, maintainability and how proposed features fit into the broader game model.
- Push back on decisions that could introduce significant complexity or architectural problems, but avoid unnecessary questions or discussion for straightforward changes.
- Favour pragmatic, proportionate solutions over rigid adherence to best practices.

## Coding style

- Prefer simple, coherent implementations. Avoid unnecessary abstractions, speculative flexibility and excessive fragmentation into small components.
- Regularly consider whether changes fit the existing architecture. Avoid allowing incremental changes to accumulate into a collection of exceptions, workarounds and patches.
- When a change exposes an underlying design problem, prefer addressing the cause rather than adding another special case.
- Where practical, separate gameplay state and rules from rendering and input handling, so game mechanics can be understood and tested independently.
- Avoid introducing new dependencies or systems when existing functionality can reasonably meet the requirement.

## Development workflow

- Favour small, independently playable changes that can be reviewed and tested through feature branches and preview deployments.
- Before completing a change, run the relevant available checks, including TypeScript validation, tests and production builds.
- Do not claim functionality has been tested unless it has actually been verified. Identify any aspects that require manual playtesting.

## specification.md

- Maintain `specification.md` as an accurate description of the game's current functionality, key systems and overall architecture.
- Update the specification whenever a change materially affects gameplay behaviour, established rules, system interactions or architecture.
- The specification should describe what systems do, how they interact and any important constraints. It need not document individual assets, trivial configuration or low-level implementation details.
- Treat the specification as a description of the current state, not a changelog. Revise, consolidate or restructure existing sections rather than simply appending information.
- Keep the document concise, clearly written and accessible to a human reader, while being sufficiently precise to constrain future development.
- Ensure that the specification remains consistent with the implementation. If an approved change supersedes existing behaviour, update the specification accordingly.
- The role of the README.md file in this repo is only to give  a brief overview of the game (max one paragraph), and to explain in very simple terms to inexperienced developers how to test run the game on their computer (npm run dev, view preview in browser etc.).