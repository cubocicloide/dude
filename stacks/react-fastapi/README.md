# @cubocicloide/stack-react-fastapi

React (Vite + TypeScript) frontend with a FastAPI backend, scaffolded by [`dude`](../../packages/dude).

## Usage

```bash
dude init my-app --stack react-fastapi
```

## Variables

| Name            | Type   | Default  | Description                           |
| --------------- | ------ | -------- | ------------------------------------- |
| `projectName`   | string | `my-app` | Project slug (kebab-case)             |
| `pythonVersion` | select | `3.12`   | Python version (`3.11`/`3.12`/`3.13`) |

## Layout produced

```
<projectName>/
├── README.md
├── .gitignore
├── frontend/   # Vite + React + TS
└── backend/    # FastAPI + uv
```
