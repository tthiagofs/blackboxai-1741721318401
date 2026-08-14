# 🎯 PROJETO: FUNIL DE CONVERSÃO

## 📋 VISÃO GERAL

O **Funil de Conversão** é uma visualização completa do fluxo de conversão do cliente, desde o primeiro contato até a venda final. Ele mostra onde os clientes entram no funil, onde saem e onde há oportunidades de otimização.

---

## 🎨 DESIGN VISUAL

### **Layout Principal**

```
┌─────────────────────────────────────────────────────────────────┐
│  🎯 FUNIL DE CONVERSÃO                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ FILTROS                                                   │  │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │  │
│  │ │ Projeto  │ │ Período  │ │ Unidade  │ │  Gerar   │    │  │
│  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ VISUALIZAÇÃO DO FUNIL                                     │  │
│  │                                                           │  │
│  │  ┌──────────────┐                                        │  │
│  │  │   IMPRESSÕES │                                        │  │
│  │  │   100.000    │                                        │  │
│  │  │   100%       │                                        │  │
│  │  └──────┬───────┘                                        │  │
│  │         │  ↓ 2%                                         │  │
│  │  ┌──────▼───────┐                                        │  │
│  │  │   CLIQUES    │                                        │  │
│  │  │   2.000      │                                        │  │
│  │  │   2.0%       │                                        │  │
│  │  └──────┬───────┘                                        │  │
│  │         │  ↓ 10%                                        │  │
│  │  ┌──────▼───────┐                                        │  │
│  │  │  MENSAGENS   │                                        │  │
│  │  │    200       │                                        │  │
│  │  │   0.2%       │                                        │  │
│  │  └──────┬───────┘                                        │  │
│  │         │  ↓ 50%                                        │  │
│  │  ┌──────▼───────┐                                        │  │
│  │  │   ORÇAMENTOS │                                        │  │
│  │  │    100       │                                        │  │
│  │  │   0.1%       │                                        │  │
│  │  └──────┬───────┘                                        │  │
│  │         │  ↓ 30%                                        │  │
│  │  ┌──────▼───────┐                                        │  │
│  │  │    VENDAS    │                                        │  │
│  │  │     30       │                                        │  │
│  │  │   0.03%      │                                        │  │
│  │  └──────────────┘                                        │  │
│  │                                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ MÉTRICAS DETALHADAS                                       │  │
│  │                                                           │  │
│  │  Taxa de Conversão: 0.03%                                │  │
│  │  Custo por Venda: R$ 150,00                              │  │
│  │  ROI: 2.5x                                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ANÁLISE DE GARGALOS                                       │  │
│  │                                                           │  │
│  │  ⚠️ Maior perda: Cliques → Mensagens (90% de abandono)  │  │
│  │  💡 Sugestão: Melhorar copy e CTA dos anúncios          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 ETAPAS DO FUNIL

### **1. IMPRESSÕES** (Topo do Funil)
- **Fonte**: Meta Ads + Google Ads
- **Dados**: Total de impressões dos anúncios
- **Visualização**: Barra larga no topo
- **Cor**: Azul claro (#E3F2FD)

### **2. CLIQUES**
- **Fonte**: Meta Ads (link_clicks) + Google Ads (clicks)
- **Dados**: Total de cliques nos anúncios
- **Visualização**: Barra média abaixo das impressões
- **Cor**: Azul (#2196F3)
- **Taxa de Conversão**: Cliques / Impressões × 100

### **3. MENSAGENS**
- **Fonte**: Meta Ads (messaging_conversation_started) + Google Ads (conversions)
- **Dados**: Total de conversas iniciadas
- **Visualização**: Barra média
- **Cor**: Verde claro (#C8E6C9)
- **Taxa de Conversão**: Mensagens / Cliques × 100

### **4. ORÇAMENTOS**
- **Fonte**: Planilha (todos os orçamentos no período)
- **Dados**: Total de orçamentos gerados
- **Visualização**: Barra média
- **Cor**: Amarelo (#FFF9C4)
- **Taxa de Conversão**: Orçamentos / Mensagens × 100

### **5. VENDAS** (Fundo do Funil)
- **Fonte**: Planilha (status = "APPROVED")
- **Dados**: Total de vendas aprovadas
- **Visualização**: Barra estreita no final
- **Cor**: Verde (#4CAF50)
- **Taxa de Conversão**: Vendas / Orçamentos × 100

---

## 🎨 COMPONENTES VISUAIS

### **1. Funil Visual (Sankey Diagram ou Barras Empilhadas)**

**Opção A: Diagrama de Barras Verticais**
```
┌─────────┐
│ 100.000 │ Impressões
│ 100%    │
└───┬─────┘
    │ ↓ 2%
┌───▼─────┐
│  2.000  │ Cliques
│  2.0%   │
└───┬─────┘
    │ ↓ 10%
┌───▼─────┐
│   200   │ Mensagens
│  0.2%   │
└─────────┘
```

**Opção B: Diagrama Sankey (Recomendado)**
- Visualização mais fluida e moderna
- Mostra fluxo de dados entre etapas
- Usa biblioteca: `chartjs-plugin-sankey` ou `plotly.js`

### **2. Cards de Métricas**

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Taxa de Conversão│  │  Custo por Venda│  │      ROI        │
│                  │  │                  │  │                 │
│      0.03%       │  │    R$ 150,00     │  │      2.5x       │
│                  │  │                  │  │                 │
│   ↑ 0.02%        │  │   ↓ R$ 20,00     │  │   ↑ 0.5x        │
│   vs período     │  │   vs período     │  │   vs período    │
│   anterior       │  │   anterior       │  │   anterior      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### **3. Gráfico de Taxas de Conversão**

```
Taxa de Conversão por Etapa:
┌─────────────────────────────────────────┐
│ Impressões → Cliques:    2.0%  ████████  │
│ Cliques → Mensagens:   10.0%  ██████████│
│ Mensagens → Orçamentos: 50.0%  █████████│
│ Orçamentos → Vendas:    30.0%  ████████ │
└─────────────────────────────────────────┘
```

### **4. Análise de Gargalos**

```
┌────────────────────────────────────────────┐
│ 🔍 ANÁLISE DE GARGALOS                      │
├────────────────────────────────────────────┤
│                                            │
│ ⚠️ MAIOR PERDA:                            │
│ Cliques → Mensagens                        │
│ Perda: 1.800 (90% de abandono)            │
│                                            │
│ 💡 RECOMENDAÇÕES:                          │
│ • Melhorar copy e CTA dos anúncios        │
│ • Testar diferentes criativos              │
│ • Otimizar landing page                    │
│                                            │
│ ✅ PONTO FORTE:                            │
│ Orçamentos → Vendas                        │
│ Taxa de conversão: 30% (acima da média)   │
└────────────────────────────────────────────┘
```

---

## 📈 FUNCIONALIDADES

### **1. Filtros**
- **Projeto**: Seleção de projeto
- **Período**: Últimos 7 dias, Este mês, Mês passado, Personalizado
- **Unidade**: Todas ou unidade específica
- **Plataforma**: Meta Ads, Google Ads, ou Ambos

### **2. Comparação de Períodos**
- Mostrar funil do período atual vs período anterior
- Destacar diferenças percentuais
- Indicadores visuais (↑ verde, ↓ vermelho)

### **3. Breakdown por Plataforma**
- Funil separado para Meta Ads e Google Ads
- Comparação lado a lado
- Identificar qual plataforma tem melhor conversão

### **4. Análise de Gargalos**
- Identificar etapa com maior perda
- Calcular taxa de abandono
- Sugerir melhorias baseadas em dados

### **5. Exportação**
- Exportar para PDF
- Exportar para Excel (XLSX)
- Compartilhar via WhatsApp

---

## 🔢 CÁLCULOS E MÉTRICAS

### **Taxas de Conversão**
```
Taxa Cliques = (Cliques / Impressões) × 100
Taxa Mensagens = (Mensagens / Cliques) × 100
Taxa Orçamentos = (Orçamentos / Mensagens) × 100
Taxa Vendas = (Vendas / Orçamentos) × 100
Taxa Geral = (Vendas / Impressões) × 100
```

### **Custos**
```
Custo por Clique = Investido / Cliques
Custo por Mensagem = Investido / Mensagens
Custo por Orçamento = Investido / Orçamentos
Custo por Venda (CPA) = Investido / Vendas
```

### **ROI**
```
ROI = (Faturamento × 0.25) / Investido
```

---

## 🎯 DADOS NECESSÁRIOS

### **Do Tráfego (APIs)**
- **Meta Ads**:
  - Impressões (`impressions`)
  - Cliques no link (`link_click` ou `outbound_click`)
  - Mensagens (`onsite_conversion.messaging_conversation_started_7d`)
  - Investimento (`spend`)

- **Google Ads**:
  - Impressões (`impressions`)
  - Cliques (`clicks`)
  - Conversões (`conversions`)
  - Investimento (`cost`)

### **Da Planilha**
- **Orçamentos**: Total de registros no período
- **Vendas**: Registros com `status = "APPROVED"`
- **Faturamento**: Soma de `value` (ou `saleValue`) dos aprovados

---

## 📱 RESPONSIVIDADE

### **Desktop (≥ 1024px)**
- Funil completo lado a lado com métricas
- Gráficos grandes e detalhados
- Análise de gargalos expandida

### **Tablet (768px - 1023px)**
- Funil empilhado verticalmente
- Métricas em grid 2x2
- Gráficos médios

### **Mobile (< 768px)**
- Funil simplificado
- Métricas em lista vertical
- Gráficos compactos

---

## 🎨 CORES E ESTILO

### **Paleta de Cores**
- **Impressões**: Azul claro (#E3F2FD)
- **Cliques**: Azul (#2196F3)
- **Mensagens**: Verde claro (#C8E6C9)
- **Orçamentos**: Amarelo (#FFF9C4)
- **Vendas**: Verde (#4CAF50)

### **Tipografia**
- **Títulos**: Font-bold, text-2xl
- **Valores**: Font-bold, text-3xl
- **Percentuais**: Font-semibold, text-lg
- **Labels**: Font-medium, text-sm

---

## 🔄 FLUXO DE DADOS

```
1. Usuário seleciona filtros (Projeto, Período, Unidade)
2. Sistema busca dados:
   ├─ Meta Ads API (impressões, cliques, mensagens)
   ├─ Google Ads API (impressões, cliques, conversões)
   └─ Planilha (orçamentos, vendas, faturamento)
3. Agrega dados por unidade/período
4. Calcula taxas de conversão
5. Identifica gargalos
6. Renderiza funil visual
7. Exibe métricas e análises
```

---

## 📦 BIBLIOTECAS SUGERIDAS

### **Visualização do Funil**
- **Opção 1**: Chart.js com plugin Sankey
- **Opção 2**: Plotly.js (Sankey diagrams nativos)
- **Opção 3**: D3.js (mais controle, mais complexo)

### **Gráficos Auxiliares**
- Chart.js (já usado no projeto)
- Para barras, linhas e comparativos

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Criar estrutura HTML da aba Funil
- [ ] Implementar filtros (Projeto, Período, Unidade)
- [ ] Integrar busca de dados (Meta + Google + Planilha)
- [ ] Criar função de agregação de dados
- [ ] Implementar cálculo de taxas de conversão
- [ ] Criar visualização do funil (Sankey ou Barras)
- [ ] Implementar cards de métricas
- [ ] Criar gráfico de taxas de conversão
- [ ] Implementar análise de gargalos
- [ ] Adicionar comparação com período anterior
- [ ] Implementar breakdown por plataforma
- [ ] Adicionar exportação (PDF, XLSX)
- [ ] Testar responsividade
- [ ] Adicionar loading states
- [ ] Implementar tratamento de erros

---

## 🎯 PRÓXIMOS PASSOS

1. **Aprovação do design** ← Você está aqui
2. Implementação da estrutura HTML
3. Integração com APIs e dados da planilha
4. Criação do funil visual
5. Implementação das análises
6. Testes e ajustes finais

---

**Aguardando sua aprovação para iniciar a implementação!** 🚀

