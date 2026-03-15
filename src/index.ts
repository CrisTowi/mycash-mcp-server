import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import express, { type Request, type Response } from 'express'
import { getAccessToken, handleUnauthorized } from './auth.js'

const BASE_URL = process.env.MYCASH_BASE_URL ?? 'https://mycash-lime.vercel.app'
const MCP_SECRET = process.env.MCP_SECRET ?? ''

async function callApi(path: string, options: RequestInit = {}): Promise<unknown> {
  const token = await getAccessToken()

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (response.status === 401) {
    await handleUnauthorized()
    const newToken = await getAccessToken()
    const retryResponse = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newToken}`,
        ...options.headers,
      },
    })
    if (!retryResponse.ok) {
      const errorText = await retryResponse.text()
      throw new Error(`API error ${retryResponse.status}: ${errorText}`)
    }
    return retryResponse.json()
  }

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API error ${response.status}: ${errorText}`)
  }

  return response.json()
}

function createServer(): Server {
  const server = new Server(
    { name: 'mycash-mcp-server', version: '1.0.0' },
    { capabilities: { tools: {} } }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'get_dashboard',
        description: 'Get a summary of all MyCash modules: budget health, loans outstanding, splits balance, net worth, and exchange rate.',
        inputSchema: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'get_budget',
        description: 'Get the budget for a period. Returns income and expense categories grouped by section with planned vs actual amounts.',
        inputSchema: {
          type: 'object',
          properties: {
            period: {
              type: 'string',
              description: 'Period start date in YYYY-MM-DD format (e.g. 2026-03-15). Defaults to current period if omitted.',
            },
          },
          required: [],
        },
      },
      {
        name: 'add_transaction',
        description: 'Add a budget transaction to a category.',
        inputSchema: {
          type: 'object',
          properties: {
            category_id: { type: 'string', description: 'UUID of the budget category' },
            amount: { type: 'number', description: 'Transaction amount (positive number)' },
            transaction_date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
            note: { type: 'string', description: 'Optional description of the transaction' },
          },
          required: ['category_id', 'amount', 'transaction_date'],
        },
      },
      {
        name: 'update_planned_amount',
        description: 'Set the planned amount for a budget category in a given period.',
        inputSchema: {
          type: 'object',
          properties: {
            category_id: { type: 'string', description: 'UUID of the budget category' },
            period: { type: 'string', description: 'Period start date in YYYY-MM-DD format' },
            planned_amount: { type: 'number', description: 'Planned amount for this category' },
          },
          required: ['category_id', 'period', 'planned_amount'],
        },
      },
      {
        name: 'get_loans',
        description: 'Get all loan people with their outstanding balances and transaction history.',
        inputSchema: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'add_loan_person',
        description: 'Add a new person to track loans with.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name of the person' },
          },
          required: ['name'],
        },
      },
      {
        name: 'add_loan',
        description: 'Log a loan given to a person.',
        inputSchema: {
          type: 'object',
          properties: {
            person_id: { type: 'string', description: 'UUID of the loan person' },
            amount: { type: 'number', description: 'Loan amount (positive)' },
            loan_date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
            description: { type: 'string', description: 'Optional description of the loan' },
          },
          required: ['person_id', 'amount', 'loan_date'],
        },
      },
      {
        name: 'add_repayment',
        description: 'Log a repayment received from a person.',
        inputSchema: {
          type: 'object',
          properties: {
            person_id: { type: 'string', description: 'UUID of the loan person' },
            amount: { type: 'number', description: 'Repayment amount (positive)' },
            repayment_date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
            note: { type: 'string', description: 'Optional note' },
          },
          required: ['person_id', 'amount', 'repayment_date'],
        },
      },
      {
        name: 'get_splits',
        description: 'Get all shared expense groups with balance summaries.',
        inputSchema: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'get_split_group',
        description: 'Get details of a specific split group including all expenses and per-member balances.',
        inputSchema: {
          type: 'object',
          properties: {
            group_id: { type: 'string', description: 'UUID of the split group' },
          },
          required: ['group_id'],
        },
      },
      {
        name: 'add_split_expense',
        description: 'Add an expense to a split group. Splits are calculated automatically based on member ratios.',
        inputSchema: {
          type: 'object',
          properties: {
            split_group_id: { type: 'string', description: 'UUID of the split group' },
            description: { type: 'string', description: 'Description of the expense' },
            total_amount: { type: 'number', description: 'Total amount of the expense' },
            expense_date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
            paid_by_member: { type: 'string', description: 'Name of the member who paid' },
          },
          required: ['split_group_id', 'description', 'total_amount', 'expense_date', 'paid_by_member'],
        },
      },
      {
        name: 'get_portfolio',
        description: 'Get the full investment portfolio including net worth, exchange rate, and all assets grouped by sub-section.',
        inputSchema: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'add_portfolio_asset',
        description: 'Add a new asset to the portfolio.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            sub_section: { type: 'string', enum: ['investments', 'safety_fund', 'retirement'] },
            asset_type: { type: 'string', enum: ['etf', 'crypto', 'bond', 'platform', 'safety_fund', 'retirement', 'other'] },
            currency: { type: 'string', enum: ['MXN', 'USD'] },
            ticker: { type: 'string' },
            quantity: { type: 'number' },
            manual_value: { type: 'number' },
            interest_rate: { type: 'number' },
            institution: { type: 'string' },
            notes: { type: 'string' },
          },
          required: ['name', 'sub_section', 'asset_type', 'currency'],
        },
      },
      {
        name: 'update_portfolio_asset',
        description: 'Update an existing portfolio asset.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            sub_section: { type: 'string', enum: ['investments', 'safety_fund', 'retirement'] },
            asset_type: { type: 'string', enum: ['etf', 'crypto', 'bond', 'platform', 'safety_fund', 'retirement', 'other'] },
            currency: { type: 'string', enum: ['MXN', 'USD'] },
            ticker: { type: 'string' },
            quantity: { type: 'number' },
            manual_value: { type: 'number' },
            interest_rate: { type: 'number' },
            institution: { type: 'string' },
            notes: { type: 'string' },
          },
          required: ['id'],
        },
      },
    ],
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    const toolArgs = (args ?? {}) as Record<string, unknown>

    try {
      let result: unknown

      switch (name) {
        case 'get_dashboard':
          result = await callApi('/api/dashboard')
          break
        case 'get_budget': {
          const period = toolArgs.period as string | undefined
          const query = period ? `?period=${period}` : ''
          result = await callApi(`/api/budget${query}`)
          break
        }
        case 'add_transaction':
          result = await callApi('/api/budget/transactions', { method: 'POST', body: JSON.stringify(toolArgs) })
          break
        case 'update_planned_amount':
          result = await callApi('/api/budget/plans', { method: 'PUT', body: JSON.stringify(toolArgs) })
          break
        case 'get_loans':
          result = await callApi('/api/loans')
          break
        case 'add_loan_person':
          result = await callApi('/api/loans/people', { method: 'POST', body: JSON.stringify(toolArgs) })
          break
        case 'add_loan':
          result = await callApi('/api/loans', { method: 'POST', body: JSON.stringify(toolArgs) })
          break
        case 'add_repayment':
          result = await callApi('/api/loans/repayments', { method: 'POST', body: JSON.stringify(toolArgs) })
          break
        case 'get_splits':
          result = await callApi('/api/splits')
          break
        case 'get_split_group':
          result = await callApi(`/api/splits/groups/${toolArgs.group_id as string}`)
          break
        case 'add_split_expense':
          result = await callApi('/api/splits/expenses', { method: 'POST', body: JSON.stringify(toolArgs) })
          break
        case 'get_portfolio':
          result = await callApi('/api/portfolio')
          break
        case 'add_portfolio_asset':
          result = await callApi('/api/portfolio/assets', { method: 'POST', body: JSON.stringify(toolArgs) })
          break
        case 'update_portfolio_asset': {
          const { id, ...updateFields } = toolArgs
          result = await callApi('/api/portfolio/assets', { method: 'PUT', body: JSON.stringify({ id, ...updateFields }) })
          break
        }
        default:
          throw new Error(`Unknown tool: ${name}`)
      }

      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true }
    }
  })

  return server
}

async function runHttp() {
  const app = express()
  app.use(express.json())

  app.post('/mcp', async (req: Request, res: Response) => {
    // Validate secret if configured
    if (MCP_SECRET) {
      const authHeader = req.headers.authorization ?? ''
      if (authHeader !== `Bearer ${MCP_SECRET}`) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }
    }

    const server = createServer()
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  })

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'mycash-mcp-server' })
  })

  const port = parseInt(process.env.PORT ?? '3001')
  app.listen(port, () => {
    console.log(`MyCash MCP server listening on port ${port}`)
  })
}

async function runStdio() {
  const server = createServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

const mode = process.env.MCP_MODE ?? 'stdio'
if (mode === 'http') {
  runHttp().catch((error) => { console.error(error); process.exit(1) })
} else {
  runStdio().catch((error) => { console.error(error); process.exit(1) })
}
