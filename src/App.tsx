import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layout/AppLayout'
import { Arsenal } from './pages/Arsenal'
import { Dashboard } from './pages/Dashboard'
import { EvaluationCenter } from './pages/EvaluationCenter'
import { EvaluationReport } from './pages/EvaluationReport'
import { McpScanReport } from './pages/McpScanReport'
import { ModelSettings } from './pages/ModelSettings'
import { NewEvaluation } from './pages/NewEvaluation'
import { NewMcpScan } from './pages/NewMcpScan'
import { QuickStart } from './pages/QuickStart'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<QuickStart />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/evaluation/model" element={<NewEvaluation />} />
        <Route path="/evaluation/mcp" element={<NewMcpScan />} />
        <Route path="/evaluation-management" element={<EvaluationCenter />} />
        <Route path="/evaluation-management/model/:id" element={<EvaluationReport />} />
        <Route path="/evaluation-management/mcp/:id" element={<McpScanReport />} />
        <Route path="/arsenal" element={<Arsenal />} />
        <Route path="/settings/model" element={<ModelSettings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
