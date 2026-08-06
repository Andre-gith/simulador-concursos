# 📚 Nota de Banca

> **Treine com a pontuação real utilizada nos principais concursos públicos brasileiros.**

O **Nota de Banca** é uma plataforma completa para criação de simulados de concursos públicos com correção baseada nas regras oficiais de cada prova. O sistema considera critérios como penalidade por erro, pesos diferentes entre questões, questões em branco, nota líquida e desempenho detalhado por matéria e bloco.

---

# ✨ Funcionalidades

* 📖 Catálogo de concursos públicos
* 📝 Criação de simulados personalizados
* 📊 Cálculo da nota conforme o edital oficial
* 📈 Estatísticas detalhadas de desempenho
* 🎯 Correção com penalidade por erro
* 📚 Organização por matérias, assuntos e blocos
* 👤 Sistema de autenticação de usuários
* 🤖 Importação assistida por Inteligência Artificial
* 🔍 Revisão humana antes da publicação
* 📜 Histórico completo de tentativas

---

# 🏛 Conceitos

## Órgão

É a instituição responsável pelo concurso, por exemplo:

* Banco do Brasil
* Caixa Econômica Federal
* Petrobras
* Transpetro
* Dataprev

## Banca

É a empresa responsável por elaborar e aplicar a prova, como:

* Cesgranrio
* Cebraspe
* FGV

> A banca **não é inferida automaticamente** pelo nome do órgão. Cada concurso possui sua própria regra de pontuação, cadastrada exclusivamente com base nos documentos oficiais.

---

# 🚀 Tecnologias

* **Next.js 15 (App Router)**
* **React 19**
* **TypeScript**
* **PostgreSQL**
* **Prisma ORM 6**
* **Tailwind CSS**
* **Auth.js**
* **Vitest**

---

# 📦 Instalação

## Pré-requisitos

* Node.js 20 ou superior
* PostgreSQL
* Banco de dados com permissões para criação do schema

Instale as dependências:

```bash
npm install
```

Copie o arquivo de ambiente:

```bash
cp .env.example .env
```

Gere o Prisma Client:

```bash
npx prisma generate
```

Crie a estrutura do banco:

```bash
npm run db:push
```

Popule os dados iniciais:

```bash
npm run db:seed
```

Carregue o catálogo editorial:

```bash
npm run catalog:seed
```

Inicie a aplicação:

```bash
npm run dev
```

> **Importante:** Nunca utilize `prisma migrate reset` em bancos que contenham dados.

---

# 🔐 Variáveis de Ambiente

Obrigatórias:

```env
DATABASE_URL=
AUTH_SECRET=
```

Opcionais (IA):

```env
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
```

Sem as variáveis da IA, o sistema continua funcionando normalmente, porém os recursos de processamento inteligente de PDFs ficam desabilitados.

⚠️ Nunca envie arquivos `.env` para o GitHub.

---

# 📚 Catálogo

O sistema divide os concursos em duas categorias:

### ✅ Disponíveis

Concursos publicados que possuem:

* Regra de pontuação cadastrada
* Questões publicadas
* Metadados completos

### 🚧 Em preparação

Concursos que estão:

* Em rascunho (Draft)
* Em revisão
* Incompletos
* Aguardando documentação oficial

O seed do catálogo é idempotente:

```bash
npm run catalog:seed
```

Ou seja, ele não remove dados existentes nem altera concursos publicados.

---

# 👤 Fluxo do Usuário

O usuário pode:

1. Localizar um concurso disponível;
2. Consultar informações da prova;
3. Escolher matérias;
4. Definir quantidade de questões;
5. Configurar tempo de prova;
6. Iniciar um simulado;
7. Responder ou deixar questões em branco;
8. Finalizar manualmente ou pelo tempo;
9. Visualizar nota, estatísticas e desempenho;
10. Revisar tentativas anteriores.

---

# 📥 Importação de Provas

Validação sem gravação:

```bash
npm run import:exam -- data/exemplo.json --dry-run
```

Importação definitiva:

```bash
npm run import:exam -- caminho/prova.json
```

Arquivos `.template.json` são recusados propositalmente para evitar importações incorretas.

---

# 🤖 Pipeline de IA

Administradores podem importar:

* PDF oficial da prova;
* PDF oficial do gabarito;
* Metadados da prova.

O sistema:

* extrai o texto;
* identifica páginas;
* gera um JSON intermediário;
* envia para IA (quando configurada);
* valida automaticamente a resposta;
* salva os dados utilizando transações do Prisma.

Nenhuma questão é publicada automaticamente.

---

# 👨‍⚖️ Revisão Humana

Todas as questões importadas permanecem inicialmente com o status:

```text
IN_REVIEW
```

Antes da publicação é possível revisar:

* Enunciado
* Alternativas
* Gabarito
* Matéria
* Assunto
* Bloco
* Peso
* Fonte oficial
* Página do documento

Um concurso somente pode ser publicado quando todas as validações forem atendidas.

---

# ⚙️ Comandos

### Desenvolvimento

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Testes

```bash
npm test
npm run test:watch
```

### Banco de Dados

```bash
npm run db:push
npm run db:generate
npm run db:seed
npm run db:studio
```

### Catálogo

```bash
npm run catalog:seed
```

### Importação

```bash
npm run import:exam -- arquivo.json --dry-run
```

---

# ⚠️ Limitações Atuais

* PDFs digitalizados precisam de OCR.
* Não existe download automático de provas.
* Os PDFs importados são armazenados localmente por padrão.
* A IA depende de configuração e pode gerar respostas inválidas.
* Toda publicação exige revisão humana.
* Regras eliminatórias nunca são inferidas automaticamente.
* Em produção recomenda-se utilizar armazenamento persistente para arquivos e um PostgreSQL gerenciado.

---

# 📖 Documentação

Consulte a pasta **/docs** para obter mais detalhes sobre:

* Catálogo
* Importação de provas
* Pipeline de Inteligência Artificial

---

# 📄 Licença

Este projeto foi desenvolvido com finalidade educacional e de preparação para concursos públicos.

As provas, gabaritos e demais conteúdos oficiais pertencem aos respectivos órgãos e bancas organizadoras.
