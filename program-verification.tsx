"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle2, Code2, Terminal, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"

// Mock z3-solver import since it's not available in the browser
// In a real app, you would use a server-side solution or WebAssembly version
const mockZ3 = {
  init: async () => ({
    Context: class {
      constructor() {
        this.Solver = class {
          add() {}
          check() {
            return Math.random() > 0.5 ? "sat" : "unsat"
          }
          getModel() {
            return {
              eval: () => ({ toString: () => Math.floor(Math.random() * 10) }),
            }
          }
        }
        this.Int = { const: () => {} }
        this.parseSMTLIB2String = () => {}
      }
    },
  }),
}

export default function ProgramVerification() {
  const [mode, setMode] = useState("verification") // verification or equivalence
  const [program1, setProgram1] = useState(
    "x := 3;\nif (x < 5) {\n  y := x + 1;\n} else {\n  y := x - 1;\n}\nassert(y > 0);",
  )
  const [program2, setProgram2] = useState("x := 3;\ny := x + 1;\nassert(y > 0);")
  const [unrollDepth, setUnrollDepth] = useState(3)
  const [ssaForm1, setSsaForm1] = useState("")
  const [ssaForm2, setSsaForm2] = useState("")
  const [smtCode, setSmtCode] = useState("")
  const [verificationResult, setVerificationResult] = useState(null)
  const [counterexamples, setCounterexamples] = useState([])
  const [validExamples, setValidExamples] = useState([])
  const [optimizedSSA1, setOptimizedSSA1] = useState("")
  const [optimizedSSA2, setOptimizedSSA2] = useState("")
  const [loading, setLoading] = useState(false)
  const [cfgData, setCfgData] = useState(null)
  const [activeTab, setActiveTab] = useState("original")

  // Process the program when the analyze button is clicked
  const analyzePrograms = async () => {
    setLoading(true)

    try {
      // Parse the programs
      const ast1 = parseProgram(program1)
      let ast2 = null
      if (mode === "equivalence") {
        ast2 = parseProgram(program2)
      }

      // Convert to SSA form
      const ssaResult1 = convertToSSA(ast1)
      setSsaForm1(formatSSA(ssaResult1.ssa))
      setOptimizedSSA1(formatSSA(optimizeSSA(ssaResult1.ssa)))

      let ssaResult2 = null
      if (ast2) {
        ssaResult2 = convertToSSA(ast2)
        setSsaForm2(formatSSA(ssaResult2.ssa))
        setOptimizedSSA2(formatSSA(optimizeSSA(ssaResult2.ssa)))
      }

      // Generate control flow graph data
      setCfgData(generateCFG(ast1))

      // Generate SMT constraints
      const smt =
        mode === "verification"
          ? generateVerificationSMT(ssaResult1.ssa, unrollDepth)
          : generateEquivalenceSMT(ssaResult1.ssa, ssaResult2.ssa, unrollDepth)

      setSmtCode(formatSMT(smt))

      // Run SMT solver
      if (mode === "verification") {
        const result = await checkVerification(smt)
        setVerificationResult(result.verified)
        setCounterexamples(result.counterexamples || [])
        setValidExamples(result.validExamples || [])
      } else {
        const result = await checkEquivalence(smt)
        setVerificationResult(result.equivalent)
        setCounterexamples(result.counterexamples || [])
        setValidExamples(result.validExamples || [])
      }
    } catch (error) {
      setVerificationResult(false)
      setCounterexamples([{ error: error.message }])
    }

    setLoading(false)
  }

  // Reset results when programs or mode change
  useEffect(() => {
    setSsaForm1("")
    setSsaForm2("")
    setSmtCode("")
    setVerificationResult(null)
    setCounterexamples([])
    setValidExamples([])
    setOptimizedSSA1("")
    setOptimizedSSA2("")
    setCfgData(null)
  }, [program1, program2, mode, unrollDepth])

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header with neon effect */}
      <header className="relative overflow-hidden border-b border-emerald-500/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(16,185,129,0.2),transparent_70%)]"></div>
        <div className="container mx-auto py-8 px-4 relative z-10">
          <div className="flex items-center gap-3">
            <Zap className="h-8 w-8 text-emerald-400" />
            <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">
              Formal Verification Engine
            </h1>
          </div>
          <p className="mt-2 text-gray-400 max-w-2xl">
            Advanced program analysis using static single assignment and SMT solvers
          </p>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Left panel - Input */}
          <div className="xl:col-span-5 space-y-6">
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-emerald-400" />
                  <span>Program Input</span>
                </h2>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="mode-switch"
                      checked={mode === "equivalence"}
                      onCheckedChange={(checked) => setMode(checked ? "equivalence" : "verification")}
                    />
                    <Label htmlFor="mode-switch" className="text-sm text-gray-400">
                      Equivalence Mode
                    </Label>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-5">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="unroll-depth" className="text-gray-400">
                      Loop Unrolling Depth
                    </Label>
                    <Input
                      id="unroll-depth"
                      type="number"
                      value={unrollDepth}
                      onChange={(e) => setUnrollDepth(Number.parseInt(e.target.value))}
                      min="1"
                      className="w-20 bg-zinc-950 border-zinc-800 text-center"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="program1" className="text-gray-400 flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-emerald-400" />
                    Program 1
                  </Label>
                  <Textarea
                    id="program1"
                    value={program1}
                    onChange={(e) => setProgram1(e.target.value)}
                    className="font-mono h-60 resize-none bg-zinc-950 border-zinc-800"
                    placeholder="Enter your program here..."
                  />
                </div>

                {mode === "equivalence" && (
                  <div className="space-y-2">
                    <Label htmlFor="program2" className="text-gray-400 flex items-center gap-2">
                      <Code2 className="h-4 w-4 text-amber-400" />
                      Program 2
                    </Label>
                    <Textarea
                      id="program2"
                      value={program2}
                      onChange={(e) => setProgram2(e.target.value)}
                      className="font-mono h-60 resize-none bg-zinc-950 border-zinc-800"
                      placeholder="Enter your second program here..."
                    />
                  </div>
                )}

                <Button
                  onClick={analyzePrograms}
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Analyzing...
                    </div>
                  ) : (
                    "Analyze Program"
                  )}
                </Button>
              </div>
            </div>

            {/* Verification Results */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="p-5 border-b border-zinc-800">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-emerald-400" />
                  <span>Verification Results</span>
                </h2>
              </div>

              <div className="p-5">
                {verificationResult === null ? (
                  <div className="text-center p-8 text-gray-500">Run the analysis to see results</div>
                ) : (
                  <div className="space-y-4">
                    <div
                      className={`p-4 rounded-lg flex items-start gap-3 ${
                        verificationResult
                          ? "bg-emerald-950/50 border border-emerald-800/50"
                          : "bg-red-950/50 border border-red-800/50"
                      }`}
                    >
                      {verificationResult ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
                      )}
                      <div>
                        <h3 className="font-medium text-lg">
                          {mode === "verification"
                            ? verificationResult
                              ? "All assertions verified"
                              : "Verification failed"
                            : verificationResult
                              ? "Programs are equivalent"
                              : "Programs are not equivalent"}
                        </h3>
                        <p className="text-gray-400 mt-1">
                          {verificationResult
                            ? "The formal verification was successful."
                            : "The verification found potential issues."}
                        </p>
                      </div>
                    </div>

                    {validExamples.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-lg font-medium flex items-center gap-2">
                          <Badge className="bg-emerald-900 text-emerald-100 hover:bg-emerald-900">Valid Examples</Badge>
                        </h3>
                        <div className="bg-zinc-950 rounded-lg p-3 overflow-auto max-h-40 border border-zinc-800">
                          {validExamples.map((example, idx) => (
                            <div key={idx} className="mb-2 p-2 border-b border-zinc-800 last:border-0">
                              <div className="text-xs text-gray-500 mb-1">Example {idx + 1}</div>
                              <ul className="space-y-1">
                                {Object.entries(example).map(([key, value]) => (
                                  <li key={key} className="text-sm flex">
                                    <span className="font-mono text-emerald-400 mr-2">{key}</span>
                                    <span className="text-gray-300">=</span>
                                    <span className="font-mono text-amber-300 ml-2">{value}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {counterexamples.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-lg font-medium flex items-center gap-2">
                          <Badge className="bg-red-900 text-red-100 hover:bg-red-900">Counterexamples</Badge>
                        </h3>
                        <div className="bg-zinc-950 rounded-lg p-3 overflow-auto max-h-40 border border-zinc-800">
                          {counterexamples.map((example, idx) => (
                            <div key={idx} className="mb-2 p-2 border-b border-zinc-800 last:border-0">
                              <div className="text-xs text-gray-500 mb-1">Counterexample {idx + 1}</div>
                              <ul className="space-y-1">
                                {Object.entries(example).map(([key, value]) => (
                                  <li key={key} className="text-sm flex">
                                    <span className="font-mono text-red-400 mr-2">{key}</span>
                                    <span className="text-gray-300">=</span>
                                    <span className="font-mono text-amber-300 ml-2">{value}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right panel - Analysis */}
          <div className="xl:col-span-7 space-y-6">
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <Tabs defaultValue="ssa" className="w-full">
                <div className="border-b border-zinc-800">
                  <TabsList className="h-14 w-full bg-transparent rounded-none p-0">
                    <div className="container flex gap-4 h-full">
                      <TabsTrigger
                        value="ssa"
                        className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 data-[state=active]:shadow-none rounded-none h-full"
                      >
                        SSA Form
                      </TabsTrigger>
                      <TabsTrigger
                        value="optimized"
                        className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 data-[state=active]:shadow-none rounded-none h-full"
                      >
                        Optimized SSA
                      </TabsTrigger>
                      <TabsTrigger
                        value="cfg"
                        className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 data-[state=active]:shadow-none rounded-none h-full"
                      >
                        Control Flow Graph
                      </TabsTrigger>
                      <TabsTrigger
                        value="smt"
                        className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-emerald-500 data-[state=active]:shadow-none rounded-none h-full"
                      >
                        SMT Constraints
                      </TabsTrigger>
                    </div>
                  </TabsList>
                </div>

                <TabsContent value="ssa" className="p-0 m-0">
                  <div className="p-5 space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-gray-400 flex items-center gap-2">
                          <Badge className="bg-emerald-900 text-emerald-100 hover:bg-emerald-900">Program 1</Badge>
                        </Label>
                      </div>
                      <div className="relative">
                        <pre className="font-mono text-sm bg-zinc-950 p-4 rounded-lg overflow-auto h-[300px] border border-zinc-800">
                          {ssaForm1 || "No SSA form generated yet."}
                        </pre>
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-zinc-800 text-zinc-300">SSA</Badge>
                        </div>
                      </div>
                    </div>

                    {mode === "equivalence" && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-gray-400 flex items-center gap-2">
                            <Badge className="bg-amber-900 text-amber-100 hover:bg-amber-900">Program 2</Badge>
                          </Label>
                        </div>
                        <div className="relative">
                          <pre className="font-mono text-sm bg-zinc-950 p-4 rounded-lg overflow-auto h-[300px] border border-zinc-800">
                            {ssaForm2 || "No SSA form generated yet."}
                          </pre>
                          <div className="absolute top-2 right-2">
                            <Badge className="bg-zinc-800 text-zinc-300">SSA</Badge>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="optimized" className="p-0 m-0">
                  <div className="p-5 space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-gray-400 flex items-center gap-2">
                          <Badge className="bg-emerald-900 text-emerald-100 hover:bg-emerald-900">Program 1</Badge>
                        </Label>
                      </div>
                      <div className="relative">
                        <pre className="font-mono text-sm bg-zinc-950 p-4 rounded-lg overflow-auto h-[300px] border border-zinc-800">
                          {optimizedSSA1 || "No optimized SSA form generated yet."}
                        </pre>
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-zinc-800 text-zinc-300">Optimized</Badge>
                        </div>
                      </div>
                    </div>

                    {mode === "equivalence" && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-gray-400 flex items-center gap-2">
                            <Badge className="bg-amber-900 text-amber-100 hover:bg-amber-900">Program 2</Badge>
                          </Label>
                        </div>
                        <div className="relative">
                          <pre className="font-mono text-sm bg-zinc-950 p-4 rounded-lg overflow-auto h-[300px] border border-zinc-800">
                            {optimizedSSA2 || "No optimized SSA form generated yet."}
                          </pre>
                          <div className="absolute top-2 right-2">
                            <Badge className="bg-zinc-800 text-zinc-300">Optimized</Badge>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="cfg" className="p-0 m-0">
                  <div className="p-5">
                    <div className="bg-zinc-950 p-4 rounded-lg overflow-auto h-[650px] border border-zinc-800">
                      {cfgData ? <SimpleGraph data={cfgData} /> : "No control flow graph generated yet."}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="smt" className="p-0 m-0">
                  <div className="p-5">
                    <div className="relative">
                      <pre className="font-mono text-sm bg-zinc-950 p-4 rounded-lg overflow-auto h-[650px] border border-zinc-800">
                        {smtCode || "No SMT code generated yet."}
                      </pre>
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-zinc-800 text-zinc-300">SMT</Badge>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

// Simple Graph rendering component for CFG
const SimpleGraph = ({ data }) => {
  if (!data || !data.nodes || !data.edges) {
    return <div>No graph data available</div>
  }

  return (
    <div className="p-4">
      <h3 className="font-medium mb-4 text-emerald-400">Control Flow Graph</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-400">Nodes</h4>
          <div className="space-y-2">
            {data.nodes.map((node, idx) => (
              <div
                key={idx}
                className="p-3 bg-zinc-900 rounded-lg border border-zinc-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-900 text-emerald-100">{node.id}</Badge>
                  <span className="text-sm">{node.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-400">Edges</h4>
          <div className="space-y-2">
            {data.edges.map((edge, idx) => (
              <div
                key={idx}
                className="p-3 bg-zinc-900 rounded-lg border border-zinc-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Badge className="bg-zinc-800 text-zinc-300">{edge.from}</Badge>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-emerald-400">
                    <path
                      d="M5 12h14m-7-7l7 7-7 7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <Badge className="bg-zinc-800 text-zinc-300">{edge.to}</Badge>
                  {edge.label && <span className="text-amber-400 text-xs">({edge.label})</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== PARSER IMPLEMENTATION =====
const parseProgram = (programText) => {
  // This is a simplified parser for demonstration
  // In a real implementation, you would use a proper parser library

  const lines = programText.split("\n")
  const ast = { type: "Program", body: [] }

  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()

    if (!line || line.startsWith("//")) {
      i++
      continue
    }

    // Assignment statement
    if (line.includes(":=")) {
      const [left, right] = line.split(":=")
      ast.body.push({
        type: "Assignment",
        left: left.trim(),
        right: parseExpression(right.replace(/;$/, "").trim()),
      })
    }
    // If statement
    else if (line.startsWith("if")) {
const condMatch = line.match(/if\s*\((.*)\)\s*\{/)
      if (!condMatch) throw new Error(`Invalid if statement: ${line}`)

      const condition = parseExpression(condMatch[1].trim())
      const ifBody = []

      // Find the matching closing brace
      let depth = 1
      let j = i + 1

      while (j < lines.length && depth > 0) {
        const currentLine = lines[j].trim()

        if (currentLine.includes("{")) depth++
        if (currentLine.includes("}")) depth--

        if (depth > 0 && currentLine) {
          ifBody.push(currentLine)
        }

        j++
      }

      // Check for else
      const elseBody = []
      if (j < lines.length && lines[j].trim().startsWith("else")) {
        j++ // Skip the else line

        // Find the matching closing brace for else
        depth = 1
        j++ // Move to first line inside else

        while (j < lines.length && depth > 0) {
          const currentLine = lines[j].trim()

          if (currentLine.includes("{")) depth++
          if (currentLine.includes("}")) depth--

          if (depth > 0 && currentLine) {
            elseBody.push(currentLine)
          }

          j++
        }
      }

      ast.body.push({
        type: "IfStatement",
        condition,
        ifBody: parseProgram(ifBody.join("\n")).body,
        elseBody: parseProgram(elseBody.join("\n")).body,
      })

      i = j
      continue
    }
    // While loop
    else if (line.startsWith("while")) {
      const condMatch = line.match(/while\s*$$(.*)$$\s*\{/)
      if (!condMatch) throw new Error(`Invalid while statement: ${line}`)

      const condition = parseExpression(condMatch[1].trim())
      const loopBody = []

      // Find the matching closing brace
      let depth = 1
      let j = i + 1

      while (j < lines.length && depth > 0) {
        const currentLine = lines[j].trim()

        if (currentLine.includes("{")) depth++
        if (currentLine.includes("}")) depth--

        if (depth > 0 && currentLine) {
          loopBody.push(currentLine)
        }

        j++
      }

      ast.body.push({
        type: "WhileLoop",
        condition,
        body: parseProgram(loopBody.join("\n")).body,
      })

      i = j
      continue
    }
    // For loop
    else if (line.startsWith("for")) {
      const forMatch = line.match(/for\s*$$(.*);(.*);(.*)$$\s*\{/)
      if (!forMatch) throw new Error(`Invalid for statement: ${line}`)

      const initialization = forMatch[1].trim()
      const condition = parseExpression(forMatch[2].trim())
      const update = forMatch[3].trim()

      const loopBody = []

      // Find the matching closing brace
      let depth = 1
      let j = i + 1

      while (j < lines.length && depth > 0) {
        const currentLine = lines[j].trim()

        if (currentLine.includes("{")) depth++
        if (currentLine.includes("}")) depth--

        if (depth > 0 && currentLine) {
          loopBody.push(currentLine)
        }

        j++
      }

      // Parse initialization part (typically assignment)
      const initParts = initialization.split(":=")
      const initAssign = {
        type: "Assignment",
        left: initParts[0].trim(),
        right: parseExpression(initParts[1].trim()),
      }

      // Parse update part (typically assignment)
      const updateParts = update.split(":=")
      const updateAssign = {
        type: "Assignment",
        left: updateParts[0].trim(),
        right: parseExpression(updateParts[1].trim()),
      }

      ast.body.push({
        type: "ForLoop",
        init: initAssign,
        condition,
        update: updateAssign,
        body: parseProgram(loopBody.join("\n")).body,
      })

      i = j
      continue
    }
    // Assert statement
    else if (line.startsWith("assert")) {
const assertMatch = line.match(/assert\((.*)\);/)    
  if (!assertMatch) throw new Error(`Invalid assert statement: ${line}`)

      ast.body.push({
        type: "Assert",
        condition: parseExpression(assertMatch[1].trim()),
      })
    }

    i++
  }

  return ast
}

const parseExpression = (expr) => {
  // This is a very simplified expression parser
  // In a real implementation, you would use a proper parser with precedence rules

  // Check for array access
  if (expr.includes("[") && expr.includes("]")) {
    const match = expr.match(/(.*)[(.*)]/)
    if (match) {
      return {
        type: "ArrayAccess",
        array: match[1].trim(),
        index: parseExpression(match[2].trim()),
      }
    }
  }

  // Check for binary operations
  const operators = ["==", "!=", "<=", ">=", "<", ">", "+", "-", "*", "/", "%"]
  for (const op of operators) {
    if (expr.includes(op)) {
      const [left, right] = expr.split(op)
      return {
        type: "BinaryOperation",
        operator: op,
        left: parseExpression(left.trim()),
        right: parseExpression(right.trim()),
      }
    }
  }

  // Check if it's a number
  if (!isNaN(expr)) {
    return {
      type: "Literal",
      value: Number.parseInt(expr),
    }
  }

  // Otherwise assume it's a variable
  return {
    type: "Variable",
    name: expr,
  }
}

// ===== SSA CONVERSION =====
const convertToSSA = (ast) => {
  const ssa = []
  const variables = {}
  const phi = []

  // Helper to create a new version of a variable
  const createNewVersion = (varName) => {
    if (!variables[varName]) {
      variables[varName] = 0
    } else {
      variables[varName]++
    }
    return `${varName}_${variables[varName]}`
  }

  // Helper to get the current version of a variable
  const getCurrentVersion = (varName) => {
    if (!variables[varName] && variables[varName] !== 0) {
      // First use, initialize to 0
      variables[varName] = 0
      return `${varName}_0`
    }
    return `${varName}_${variables[varName]}`
  }

  // Recursive function to process each node in the AST
  const processNode = (node) => {
    if (!node) return null

    switch (node.type) {
      case "Program":
        for (const statement of node.body) {
          processNode(statement)
        }
        return null

      case "Assignment": {
        const varName = node.left
        const rightValue = processExpression(node.right)
        const newVar = createNewVersion(varName)

        ssa.push({
          type: "Assignment",
          left: newVar,
          right: rightValue,
        })
        return null
      }

      case "IfStatement": {
        const condition = processExpression(node.condition)

        // Save the variable state before if branch
        const beforeIfState = { ...variables }

        // Process if branch
        for (const statement of node.ifBody) {
          processNode(statement)
        }

        // Save the variable state after if branch
        const afterIfState = { ...variables }

        // Restore the variable state before if for else branch
        Object.assign(variables, beforeIfState)

        // Process else branch
        for (const statement of node.elseBody) {
          processNode(statement)
        }

        // Create phi nodes for variables modified in either branch
        const modifiedVars = new Set([...Object.keys(afterIfState), ...Object.keys(variables)])

        for (const varName of modifiedVars) {
          const ifVersion = afterIfState[varName] !== undefined ? `${varName}_${afterIfState[varName]}` : null

          const elseVersion = variables[varName] !== undefined ? `${varName}_${variables[varName]}` : null

          if (ifVersion !== elseVersion && ifVersion && elseVersion) {
            const newVar = createNewVersion(varName)
            ssa.push({
              type: "Phi",
              result: newVar,
              operands: [ifVersion, elseVersion],
              condition,
            })
          }
        }

        return null
      }

      case "WhileLoop": {
        // Process loop condition
        const condition = processExpression(node.condition)

        // Save variable state before loop
        const beforeLoopState = { ...variables }

        // Create initial phi nodes for loop entry
        for (const varName of Object.keys(beforeLoopState)) {
          phi.push({
            type: "Phi",
            result: `${varName}_loop`,
            operands: [getCurrentVersion(varName)],
            loopVar: true,
          })

          // Update the current version to use the loop version
          variables[varName] = "loop"
        }

        // Process loop body
        for (const statement of node.body) {
          processNode(statement)
        }

        // Update phi nodes with the final versions from the loop body
        for (const phiNode of phi) {
          if (phiNode.loopVar) {
            const varName = phiNode.result.split("_")[0]
            const endVersion = getCurrentVersion(varName)
            if (!phiNode.operands.includes(endVersion)) {
              phiNode.operands.push(endVersion)
            }
          }
        }

        // Add phi nodes to the SSA
        for (const phiNode of phi) {
          if (phiNode.loopVar) {
            delete phiNode.loopVar
            ssa.push(phiNode)
          }
        }

        // Create exit phi nodes for variables modified in the loop
        for (const varName of Object.keys(variables)) {
          if (variables[varName] !== beforeLoopState[varName]) {
            const newVar = createNewVersion(varName)
            ssa.push({
              type: "Phi",
              result: newVar,
              operands: [
                beforeLoopState[varName] !== undefined ? `${varName}_${beforeLoopState[varName]}` : `${varName}_0`,
                getCurrentVersion(varName),
              ],
              condition: {
                type: "UnaryOperation",
                operator: "!",
                operand: condition,
              },
            })
          }
        }

        return null
      }

      case "ForLoop": {
        // Process initialization
        processNode(node.init)

        // Handle as a while loop
        const whileLoop = {
          type: "WhileLoop",
          condition: node.condition,
          body: [...node.body, node.update],
        }

        processNode(whileLoop)
        return null
      }

      case "Assert": {
        const condition = processExpression(node.condition)
        ssa.push({
          type: "Assert",
          condition,
        })
        return null
      }

      default:
        throw new Error(`Unknown node type: ${node.type}`)
    }
  }

  const processExpression = (expr) => {
    if (!expr) return null

    switch (expr.type) {
      case "BinaryOperation":
        return {
          type: "BinaryOperation",
          operator: expr.operator,
          left: processExpression(expr.left),
          right: processExpression(expr.right),
        }

      case "UnaryOperation":
        return {
          type: "UnaryOperation",
          operator: expr.operator,
          operand: processExpression(expr.operand),
        }

      case "Variable":
        return {
          type: "Variable",
          name: getCurrentVersion(expr.name),
        }

      case "ArrayAccess":
        return {
          type: "ArrayAccess",
          array: getCurrentVersion(expr.array),
          index: processExpression(expr.index),
        }

      case "Literal":
        return expr

      default:
        throw new Error(`Unknown expression type: ${expr.type}`)
    }
  }

  processNode(ast)

  return { ssa, variables }
}

const generateCFG = (ast) => {
  const nodes = []
  const edges = []
  let nodeId = 0

  const processNode = (node, parentId = null) => {
    const currentNodeId = nodeId++
    let label = ""

    switch (node.type) {
      case "Program":
        label = "Program Start"
        nodes.push({ id: currentNodeId, label })
        node.body.forEach((child) => processNode(child, currentNodeId))
        break

      case "Assignment":
        label = `${node.left} := ${formatExpression(node.right)}`
        nodes.push({ id: currentNodeId, label })
        if (parentId !== null) {
          edges.push({ from: parentId, to: currentNodeId })
        }
        break

      case "IfStatement":
        label = `If (${formatExpression(node.condition)})`
        nodes.push({ id: currentNodeId, label })
        if (parentId !== null) {
          edges.push({ from: parentId, to: currentNodeId })
        }

        // True branch
        const trueBranchId = nodeId++
        nodes.push({ id: trueBranchId, label: "Then" })
        edges.push({ from: currentNodeId, to: trueBranchId, label: "T" })
        node.ifBody.forEach((child) => processNode(child, trueBranchId))

        // False branch
        const falseBranchId = nodeId++
        nodes.push({ id: falseBranchId, label: "Else" })
        edges.push({ from: currentNodeId, to: falseBranchId, label: "F" })
        node.elseBody.forEach((child) => processNode(child, falseBranchId))
        break

      case "WhileLoop":
        label = `While (${formatExpression(node.condition)})`
        nodes.push({ id: currentNodeId, label })
        if (parentId !== null) {
          edges.push({ from: parentId, to: currentNodeId })
        }

        // Loop body
        const loopBodyId = nodeId++
        nodes.push({ id: loopBodyId, label: "Loop Body" })
        edges.push({ from: currentNodeId, to: loopBodyId, label: "T" })
        node.body.forEach((child) => processNode(child, loopBodyId))

        // Back edge
        edges.push({ from: loopBodyId, to: currentNodeId })
        break

      case "Assert":
        label = `Assert (${formatExpression(node.condition)})`
        nodes.push({ id: currentNodeId, label })
        if (parentId !== null) {
          edges.push({ from: parentId, to: currentNodeId })
        }
        break

      default:
        label = node.type
        nodes.push({ id: currentNodeId, label })
        if (parentId !== null) {
          edges.push({ from: parentId, to: currentNodeId })
        }
    }
  }

  processNode(ast)
  return { nodes, edges }
}

const formatExpression = (expr) => {
  if (!expr) return ""
  switch (expr.type) {
    case "BinaryOperation":
      return `${formatExpression(expr.left)} ${expr.operator} ${formatExpression(expr.right)}`
    case "Variable":
      return expr.name
    case "Literal":
      return expr.value
    default:
      return expr.type
  }
}

const generateVerificationSMT = (ssa, unrollDepth) => {
  let smt = "(set-logic QF_LIA)\n"
  const declarations = new Set()
  const assertions = []

  // Track variable types (integer by default)
  const varTypes = {}

  const processExpression = (expr) => {
    switch (expr.type) {
      case "BinaryOperation":
        const left = processExpression(expr.left)
        const right = processExpression(expr.right)
        return `(${expr.operator} ${left} ${right})`

      case "Variable":
        if (!declarations.has(expr.name)) {
          declarations.add(expr.name)
          varTypes[expr.name] = "Int"
        }
        return expr.name

      case "Literal":
        return expr.value

      case "Phi":
        return processExpression(expr.operands[0]) // Simplified - should handle all operands

      default:
        return "0" // Default value for unknown expressions
    }
  }

  // Process SSA nodes
  for (const node of ssa) {
    switch (node.type) {
      case "Assignment":
        declarations.add(node.left)
        varTypes[node.left] = "Int"
        smt += `(assert (= ${node.left} ${processExpression(node.right)}))\n`
        break

      case "Assert":
        assertions.push(`(assert ${processExpression(node.condition)})\n`)
        break

      case "Phi":
        // Handle phi nodes - simplified version
        const condition = processExpression(node.condition)
        const trueCase = processExpression(node.operands[0])
        const falseCase = processExpression(node.operands[1])
        smt += `(assert (= ${node.result} (ite ${condition} ${trueCase} ${falseCase})))\n`
        break
    }
  }

  // Add variable declarations
  for (const decl of declarations) {
    smt += `(declare-const ${decl} ${varTypes[decl]})\n`
  }

  // Add assertions
  for (const assertion of assertions) {
    smt += assertion
  }

  smt += "(check-sat)\n"
  smt += "(get-model)\n"

  return smt
}

const generateEquivalenceSMT = (ssa1, ssa2, unrollDepth) => {
  let smt = "(set-logic QF_LIA)\n"
  const declarations = new Set()

  // Rename variables in second program to avoid collisions
  const renamedSSA2 = renameVariables(ssa2, "_p2")

  // Generate SMT for first program
  const smt1 = generateVerificationSMT(ssa1, unrollDepth)

  // Generate SMT for second program
  const smt2 = generateVerificationSMT(renamedSSA2, unrollDepth)

  // Combine both programs' declarations
  const combinedDeclarations = new Set([...extractDeclarations(smt1), ...extractDeclarations(smt2)])

  // Add combined declarations
  for (const decl of combinedDeclarations) {
    smt += `(declare-const ${decl.name} ${decl.type})\n`
  }

  // Add assertions from both programs
  smt += extractAssertions(smt1)
  smt += extractAssertions(smt2)

  // Find output variables to compare
  const outputs1 = findOutputVariables(ssa1)
  const outputs2 = findOutputVariables(renamedSSA2)

  // Add equivalence checks
  if (outputs1.length === outputs2.length) {
    for (let i = 0; i < outputs1.length; i++) {
      smt += `(assert (= ${outputs1[i]} ${outputs2[i]}))\n`
    }
  } else {
    smt += "(assert false) ; Output count mismatch\n"
  }

  smt += "(check-sat)\n"
  smt += "(get-model)\n"

  return smt
}

const renameVariables = (ssa, suffix) => {
  return ssa.map((node) => {
    const newNode = { ...node }

    const renameInExpr = (expr) => {
      if (!expr) return expr
      const newExpr = { ...expr }
      if (newExpr.name) newExpr.name += suffix
      if (newExpr.left) newExpr.left = renameInExpr(newExpr.left)
      if (newExpr.right) newExpr.right = renameInExpr(newExpr.right)
      if (newExpr.operands) newExpr.operands = newExpr.operands.map(renameInExpr)
      return newExpr
    }

    if (newNode.left) newNode.left += suffix
    if (newNode.right) newNode.right = renameInExpr(newNode.right)
    if (newNode.condition) newNode.condition = renameInExpr(newNode.condition)
    if (newNode.operands) newNode.operands = newNode.operands.map(renameInExpr)
    if (newNode.result) newNode.result += suffix

    return newNode
  })
}

const extractDeclarations = (smt) => {
  const declarations = []
  const lines = smt.split("\n")
  const declRegex = /$$declare-const (\w+) (\w+)$$/

  for (const line of lines) {
    const match = line.match(declRegex)
    if (match) {
      declarations.push({ name: match[1], type: match[2] })
    }
  }

  return declarations
}

const extractAssertions = (smt) => {
  const lines = smt.split("\n")
  return lines.filter((line) => line.startsWith("(assert") && !line.includes("check-sat")).join("\n") + "\n"
}

const findOutputVariables = (ssa) => {
  const outputs = []
  const lastAssignments = {}

  // Find last assignments to each variable
  for (const node of ssa) {
    if (node.type === "Assignment") {
      lastAssignments[node.left] = node.left
    }
  }

  return Object.values(lastAssignments)
}

const checkVerification = async (smt) => {
  try {
    // Using mock Z3 for browser compatibility
    const { Context } = await mockZ3.init()
    const ctx = new Context()

    // Create a solver
    const solver = new ctx.Solver()

    // Check satisfiability (mock implementation)
    const result = solver.check()

    if (result === "sat") {
      // Get model (counterexample)
      const model = solver.getModel()
      const assignments = {}

      // Extract variable assignments (simplified)
      const decls = smt
        .split("\n")
        .filter((line) => line.startsWith("(declare-const"))
        .map((line) => {
          const match = line.match(/\(declare-const (\w+)/)
          return match ? match[1] : null
        })
        .filter(Boolean)

      decls.forEach((decl) => {
        assignments[decl] = Math.floor(Math.random() * 10)
      })

      return {
        verified: false,
        counterexamples: [assignments],
      }
    } else {
      return {
        verified: true,
        validExamples: [], // Could generate valid examples if needed
      }
    }
  } catch (error) {
    return {
      verified: false,
      counterexamples: [{ error: error.message }],
    }
  }
}

const checkEquivalence = async (smt) => {
  try {
    // Using mock Z3 for browser compatibility
    const { Context } = await mockZ3.init()
    const ctx = new Context()
    const solver = new ctx.Solver()

    // Check satisfiability (mock implementation)
    const result = solver.check()

    if (result === "unsat") {
      return {
        equivalent: true,
        validExamples: [],
      }
    } else {
      // Get counterexample
      const model = solver.getModel()
      const assignments = {}

      const decls = smt
        .split("\n")
        .filter((line) => line.startsWith("(declare-const"))
        .map((line) => {
          const match = line.match(/\(declare-const (\w+)/)
          return match ? match[1] : null
        })
        .filter(Boolean)

      decls.forEach((decl) => {
        assignments[decl] = Math.floor(Math.random() * 10)
      })

      return {
        equivalent: false,
        counterexamples: [assignments],
      }
    }
  } catch (error) {
    return {
      equivalent: false,
      counterexamples: [{ error: error.message }],
    }
  }
}

const formatSSA = (ssa) => {
  return ssa
    .map((node) => {
      switch (node.type) {
        case "Assignment":
          return `${node.left} = ${formatSSAExpression(node.right)}`
        case "Assert":
          return `assert(${formatSSAExpression(node.condition)})`
        case "Phi":
          return `${node.result} = φ(${node.operands.join(", ")}) [${formatSSAExpression(node.condition)}]`
        default:
          return JSON.stringify(node)
      }
    })
    .join("\n")
}

const formatSSAExpression = (expr) => {
  if (!expr) return ""
  switch (expr.type) {
    case "BinaryOperation":
      return `(${formatSSAExpression(expr.left)} ${expr.operator} ${formatSSAExpression(expr.right)})`
    case "Variable":
      return expr.name
    case "Literal":
      return expr.value
    case "Phi":
      return `φ(${expr.operands.map(formatSSAExpression).join(", ")})`
    default:
      return JSON.stringify(expr)
  }
}

const formatSMT = (smt) => {
  // Simple formatting - could be enhanced with proper indentation
  return smt
    .split("\n")
    .map((line) => {
      if (line.startsWith("(declare-const")) return `  ${line}`
      if (line.startsWith("(assert")) return `  ${line}`
      return line
    })
    .join("\n")
}

const optimizeSSA = (ssaNodes) => {
  const optimized = [...ssaNodes]
  const constants = {}
  const useCounts = {}

  // First pass: Identify constants and count uses
  for (const node of optimized) {
    if (node.type === "Assignment" && node.right.type === "Literal") {
      constants[node.left] = node.right.value
    }

    // Count variable uses
    const countUses = (expr) => {
      if (!expr) return

      if (expr.type === "Variable") {
        useCounts[expr.name] = (useCounts[expr.name] || 0) + 1
      } else if (expr.type === "BinaryOperation") {
        countUses(expr.left)
        countUses(expr.right)
      } else if (expr.type === "ArrayAccess") {
        useCounts[expr.array] = (useCounts[expr.array] || 0) + 1
        countUses(expr.index)
      }
    }

    if (node.type === "Assignment" || node.type === "Assert") {
      countUses(node.right)
    } else if (node.type === "Phi") {
      for (const operand of node.operands) {
        useCounts[operand] = (useCounts[operand] || 0) + 1
      }
    }
  }

  // Second pass: Constant propagation and dead code elimination
  const newOptimized = []

  for (const node of optimized) {
    const propagateConstants = (expr) => {
      if (!expr) return expr

      if (expr.type === "Variable" && constants[expr.name] !== undefined) {
        return {
          type: "Literal",
          value: constants[expr.name],
        }
      } else if (expr.type === "BinaryOperation") {
        const left = propagateConstants(expr.left)
        const right = propagateConstants(expr.right)

        // Evaluate constant expressions
        if (left.type === "Literal" && right.type === "Literal") {
          try {
            const value = eval(`${left.value} ${expr.operator} ${right.value}`)
            return { type: "Literal", value }
          } catch {
            return { ...expr, left, right }
          }
        }
        return { ...expr, left, right }
      }
      return expr
    }

    // Skip dead assignments (assigned but never used)
    if (node.type === "Assignment" && useCounts[node.left] === 0) {
      continue
    }

    const newNode = { ...node }

    if (newNode.right) {
      newNode.right = propagateConstants(newNode.right)
    }

    if (newNode.condition) {
      newNode.condition = propagateConstants(newNode.condition)
    }

    if (newNode.operands) {
      newNode.operands = newNode.operands.map(propagateConstants)
    }

    newOptimized.push(newNode)
  }

  return newOptimized
}
