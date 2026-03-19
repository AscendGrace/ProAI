import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import './QuickStart.css'

function triggerFireworks() {
  const canvas = document.createElement('canvas')
  canvas.style.position = 'fixed'
  canvas.style.top = '0'
  canvas.style.left = '0'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '9999'
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d')!
  const particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string }> = []

  function createFirework(x: number, y: number) {
    const colors = ['#5d8fff', '#48d18f', '#ffa94d', '#ff6b9d', '#c084fc', '#fbbf24', '#f87171']
    for (let i = 0; i < 80; i++) {
      const angle = (Math.PI * 2 * i) / 80
      const speed = 3 + Math.random() * 5
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color: colors[Math.floor(Math.random() * colors.length)]
      })
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.1
      p.life -= 0.01

      if (p.life <= 0) {
        particles.splice(i, 1)
        continue
      }

      ctx.globalAlpha = p.life
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
      ctx.fill()
    }

    if (particles.length > 0) {
      requestAnimationFrame(animate)
    } else {
      document.body.removeChild(canvas)
    }
  }

  createFirework(window.innerWidth / 2, window.innerHeight / 3)
  setTimeout(() => createFirework(window.innerWidth / 3, window.innerHeight / 2), 200)
  setTimeout(() => createFirework((window.innerWidth * 2) / 3, window.innerHeight / 2), 400)
  animate()
}

export function QuickStart() {
  useEffect(() => {
    const hasSeenTour = localStorage.getItem('quickStartTourSeen')
    if (!hasSeenTour) {
      const driverObj = driver({
        showProgress: true,
        nextBtnText: '下一步',
        prevBtnText: '上一步',
        doneBtnText: '完成',
        steps: [
          {
            element: 'a[href="/"]',
            popover: {
              title: '欢迎使用 ProAI',
              description: '让我们快速了解系统的主要功能模块'
            }
          },
          {
            element: 'a[href="/settings/model"]',
            popover: {
              title: '模型设置',
              description: '配置用于评分的裁判模型，支持 Ollama 和 OpenAI 协议'
            }
          },
          {
            element: 'a[href="/arsenal"]',
            popover: {
              title: '弹药库',
              description: '管理测试集，支持 TC260、通用测试集和自定义测试集'
            }
          },
          {
            element: 'a[href="/evaluation-management"]',
            popover: {
              title: '评估管理',
              description: '查看所有评估任务的执行状态和详细报告'
            }
          },
          {
            element: 'button.navItem',
            popover: {
              title: '评估中心',
              description: '创建模型评估和 MCP 评估任务'
            }
          },
          {
            element: 'a[href="/dashboard"]',
            popover: {
              title: '数据面板',
              description: '查看评估趋势、弹药库占比等统计数据'
            }
          },
        ],
        onDestroyStarted: () => {
          localStorage.setItem('quickStartTourSeen', 'true')
          driverObj.destroy()
          triggerFireworks()
        }
      })
      setTimeout(() => driverObj.drive(), 500)
    }
  }, [])

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {/* 装饰图片 */}
      <div style={{
        position: 'absolute',
        right: 130,
        top: -90,
        width: 370,
        height: 460,
        zIndex: 1,
        pointerEvents: 'none',
      }}>
        <img
          src="/home.png"
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            opacity: 0.7,
          }}
        />
      </div>

      {/* Hero 区域 - 无边框 */}
      <section style={{
        background: 'transparent',
        padding: '32px 0',
        marginBottom: 24,
        position: 'relative',
        maxWidth: 'calc(50% - 10px)',
      }}>
        <h1 style={{
          fontSize: 24,
          fontWeight: 600,
          color: 'var(--foreground)',
          margin: '0 0 16px 0',
          letterSpacing: '-0.02em',
        }}>
          欢迎使用华清未央 ProAI 大模型安全评估系统
        </h1>
        <p style={{
          fontSize: 14,
          color: 'var(--muted-foreground)',
          lineHeight: 1.8,
          margin: 0,
        }}>
          在 AI 应用规模化落地的今天，模型越狱、提示词注入等新型安全威胁层出不穷。通过我们的平台，您可以快速开展基于TC260系列标准的合规评估工作，帮助您的企业在模型正式上线前精准识别潜在风险、生成结构化合规报告、满足监管备案要求，以最低的安全成本换取最高的合规置信度——让每一个 AI 应用都能安全、可信地走向生产环境。
        </p>
      </section>

      {/* 步骤卡片 - 2x2 布局，无外边框 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 20,
        position: 'relative',
        zIndex: 1,
        marginTop: 100,
      }}>
        {/* 步骤 01 - 配置裁判模型 */}
        <Link to="/settings/model" className="step-card">
          <div className="step-card-header">
            <span className="step-number">1</span>
            <span className="step-title">配置裁判模型</span>
          </div>
          <div className="step-subtitle">
            前往裁判模型设置配置打分模型
          </div>
          <div className="step-description">
            设置用于对被测模型输出进行安全评分的裁判模型，支持Ollama和OpenAI协议，可自定义系统提示词，实现精准的风险内容识别与判定
          </div>
        </Link>

        {/* 步骤 02 - 弹药库管理测试集 */}
        <Link to="/arsenal" className="step-card">
          <div className="step-card-header">
            <span className="step-number">2</span>
            <span className="step-title">管理测试集</span>
          </div>
          <div className="step-subtitle">
            前往弹药库导入/维护测试集
          </div>
          <div className="step-description">
            支持国标库（TC260）、通用测试集、自定义测试集三种类型测试集，可批量导入CSV格式数据，支持按风险类型分类管理提示词，构建完善的安全测试语料库
          </div>
        </Link>

        {/* 步骤 03 - 新建评估任务 */}
        <Link to="/evaluation/model" className="step-card">
          <div className="step-card-header">
            <span className="step-number">3</span>
            <span className="step-title">新建评估任务</span>
          </div>
          <div className="step-subtitle">
            配置被测模型接口与测试集
          </div>
          <div className="step-description">
            两步完成评估配置：第一步配置被测模型的Provider、Base URL、API Key等参数；第二步选择测试集类型和测试条数，支持连通测试确保配置正确后启动评估
          </div>
        </Link>

        {/* 步骤 04 - 查看评估报告 */}
        <Link to="/evaluation-management" className="step-card">
          <div className="step-card-header">
            <span className="step-number">4</span>
            <span className="step-title">查看评估报告</span>
          </div>
          <div className="step-subtitle">
            前往评估管理查看任务列表
          </div>
          <div className="step-description">
            实时查看评估任务执行状态和通过率，点击进入详细评估报告，展示风险概况、各维度测试结果、攻击样例等核心指标，生成结构化合规报告
          </div>
        </Link>
      </div>

      {/* 版权说明 */}
      <div style={{
        marginTop: 48,
        paddingTop: 24,
        borderTop: '1px solid #e1e4e8',
        textAlign: 'center',
        color: 'var(--muted-foreground)',
        fontSize: 12,
      }}>
        © 2026 华清未央 · 玉衡实验室 ProAI. All rights reserved.
      </div>

    </div>
  )
}
