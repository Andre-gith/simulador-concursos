import {
  PrismaClient,
  QuestionType,
  ScoringType,
} from "@prisma/client";

const prisma = new PrismaClient();

type AlternativeSeed = {
  letter: string;
  text: string;
  isCorrect: boolean;
};

type QuestionSeed = {
  concursoId: string;
  subjectId: string;
  topicId?: string;
  type: QuestionType;
  statement: string;
  ceAnswer?: boolean;
  alternatives?: AlternativeSeed[];
};

async function createOrUpdateConcurso({
  bancaId,
  orgao,
  cargo,
  ano,
}: {
  bancaId: string;
  orgao: string;
  cargo: string;
  ano: number;
}) {
  const existingConcurso = await prisma.concurso.findFirst({
    where: {
      bancaId,
      orgao,
      cargo,
      ano,
    },
  });

  if (existingConcurso) {
    return prisma.concurso.update({
      where: {
        id: existingConcurso.id,
      },
      data: {
        bancaId,
        orgao,
        cargo,
        ano,
      },
    });
  }

  return prisma.concurso.create({
    data: {
      bancaId,
      orgao,
      cargo,
      ano,
    },
  });
}

async function createOrUpdateQuestion(data: QuestionSeed) {
  const existingQuestion = await prisma.question.findFirst({
    where: {
      concursoId: data.concursoId,
      statement: data.statement,
    },
  });

  if (existingQuestion) {
    await prisma.alternative.deleteMany({
      where: {
        questionId: existingQuestion.id,
      },
    });

    return prisma.question.update({
      where: {
        id: existingQuestion.id,
      },
      data: {
        subjectId: data.subjectId,
        topicId: data.topicId ?? null,
        type: data.type,
        statement: data.statement,
        ceAnswer:
          data.type === QuestionType.CE
            ? data.ceAnswer ?? null
            : null,
        alternatives:
          data.alternatives && data.alternatives.length > 0
            ? {
                create: data.alternatives,
              }
            : undefined,
      },
    });
  }

  return prisma.question.create({
    data: {
      concursoId: data.concursoId,
      subjectId: data.subjectId,
      topicId: data.topicId ?? null,
      type: data.type,
      statement: data.statement,
      ceAnswer:
        data.type === QuestionType.CE
          ? data.ceAnswer ?? null
          : null,
      alternatives:
        data.alternatives && data.alternatives.length > 0
          ? {
              create: data.alternatives,
            }
          : undefined,
    },
  });
}

async function main() {
  console.log("Iniciando seed do banco de dados...");

  /*
   * Bancas
   */
  const cebraspe = await prisma.banca.upsert({
    where: {
      name: "CEBRASPE",
    },
    update: {},
    create: {
      name: "CEBRASPE",
    },
  });

  const cesgranrio = await prisma.banca.upsert({
    where: {
      name: "CESGRANRIO",
    },
    update: {},
    create: {
      name: "CESGRANRIO",
    },
  });

  const fgv = await prisma.banca.upsert({
    where: {
      name: "FGV",
    },
    update: {},
    create: {
      name: "FGV",
    },
  });

  console.log("Bancas criadas ou atualizadas:", {
    cebraspe,
    cesgranrio,
    fgv,
  });

  /*
   * Matérias
   */
  const linguaPortuguesa = await prisma.subject.upsert({
    where: {
      name: "Língua Portuguesa",
    },
    update: {},
    create: {
      name: "Língua Portuguesa",
    },
  });

  const informatica = await prisma.subject.upsert({
    where: {
      name: "Informática",
    },
    update: {},
    create: {
      name: "Informática",
    },
  });

  const direitoConstitucional = await prisma.subject.upsert({
    where: {
      name: "Direito Constitucional",
    },
    update: {},
    create: {
      name: "Direito Constitucional",
    },
  });

  const raciocinioLogico = await prisma.subject.upsert({
    where: {
      name: "Raciocínio Lógico",
    },
    update: {},
    create: {
      name: "Raciocínio Lógico",
    },
  });

  const matematica = await prisma.subject.upsert({
    where: {
      name: "Matemática",
    },
    update: {},
    create: {
      name: "Matemática",
    },
  });

  const administracaoPublica = await prisma.subject.upsert({
    where: {
      name: "Administração Pública",
    },
    update: {},
    create: {
      name: "Administração Pública",
    },
  });

  /*
   * Assuntos
   */
  const interpretacaoTexto = await prisma.topic.upsert({
    where: {
      subjectId_name: {
        subjectId: linguaPortuguesa.id,
        name: "Interpretação de texto",
      },
    },
    update: {},
    create: {
      subjectId: linguaPortuguesa.id,
      name: "Interpretação de texto",
    },
  });

  const gramatica = await prisma.topic.upsert({
    where: {
      subjectId_name: {
        subjectId: linguaPortuguesa.id,
        name: "Gramática",
      },
    },
    update: {},
    create: {
      subjectId: linguaPortuguesa.id,
      name: "Gramática",
    },
  });

  const segurancaInformacao = await prisma.topic.upsert({
    where: {
      subjectId_name: {
        subjectId: informatica.id,
        name: "Segurança da informação",
      },
    },
    update: {},
    create: {
      subjectId: informatica.id,
      name: "Segurança da informação",
    },
  });

  const internetProtocolos = await prisma.topic.upsert({
    where: {
      subjectId_name: {
        subjectId: informatica.id,
        name: "Internet e protocolos",
      },
    },
    update: {},
    create: {
      subjectId: informatica.id,
      name: "Internet e protocolos",
    },
  });

  const principiosFundamentais = await prisma.topic.upsert({
    where: {
      subjectId_name: {
        subjectId: direitoConstitucional.id,
        name: "Princípios fundamentais",
      },
    },
    update: {},
    create: {
      subjectId: direitoConstitucional.id,
      name: "Princípios fundamentais",
    },
  });

  const poderesEstado = await prisma.topic.upsert({
    where: {
      subjectId_name: {
        subjectId: direitoConstitucional.id,
        name: "Poderes do Estado",
      },
    },
    update: {},
    create: {
      subjectId: direitoConstitucional.id,
      name: "Poderes do Estado",
    },
  });

  const proposicoes = await prisma.topic.upsert({
    where: {
      subjectId_name: {
        subjectId: raciocinioLogico.id,
        name: "Proposições lógicas",
      },
    },
    update: {},
    create: {
      subjectId: raciocinioLogico.id,
      name: "Proposições lógicas",
    },
  });

  const porcentagem = await prisma.topic.upsert({
    where: {
      subjectId_name: {
        subjectId: matematica.id,
        name: "Porcentagem",
      },
    },
    update: {},
    create: {
      subjectId: matematica.id,
      name: "Porcentagem",
    },
  });

  const planejamento = await prisma.topic.upsert({
    where: {
      subjectId_name: {
        subjectId: administracaoPublica.id,
        name: "Planejamento",
      },
    },
    update: {},
    create: {
      subjectId: administracaoPublica.id,
      name: "Planejamento",
    },
  });

  console.log("Matérias e assuntos criados ou atualizados.");

  /*
   * Concurso CEBRASPE
   */
  const concursoCebraspe = await createOrUpdateConcurso({
    bancaId: cebraspe.id,
    orgao: "Simulado Demonstrativo",
    cargo: "Analista Administrativo",
    ano: 2026,
  });

  await prisma.scoringRule.upsert({
    where: {
      concursoId: concursoCebraspe.id,
    },
    update: {
      type: ScoringType.CE_PENALTY,
      pointsCorrect: 1,
      pointsWrong: -1,
      pointsBlank: 0,
    },
    create: {
      concursoId: concursoCebraspe.id,
      type: ScoringType.CE_PENALTY,
      pointsCorrect: 1,
      pointsWrong: -1,
      pointsBlank: 0,
    },
  });

  const cebraspeQuestions: QuestionSeed[] = [
    {
      concursoId: concursoCebraspe.id,
      subjectId: linguaPortuguesa.id,
      topicId: interpretacaoTexto.id,
      type: QuestionType.CE,
      statement:
        "Em um texto argumentativo, a tese corresponde à ideia principal defendida pelo autor.",
      ceAnswer: true,
    },
    {
      concursoId: concursoCebraspe.id,
      subjectId: linguaPortuguesa.id,
      topicId: gramatica.id,
      type: QuestionType.CE,
      statement:
        "O uso de vírgula entre o sujeito e o verbo é obrigatório quando o sujeito é longo.",
      ceAnswer: false,
    },
    {
      concursoId: concursoCebraspe.id,
      subjectId: informatica.id,
      topicId: segurancaInformacao.id,
      type: QuestionType.CE,
      statement:
        "A autenticação em dois fatores adiciona uma segunda etapa de verificação além da senha.",
      ceAnswer: true,
    },
    {
      concursoId: concursoCebraspe.id,
      subjectId: informatica.id,
      topicId: segurancaInformacao.id,
      type: QuestionType.CE,
      statement:
        "O protocolo HTTPS impede totalmente que um dispositivo infectado por malware tenha seus dados roubados.",
      ceAnswer: false,
    },
    {
      concursoId: concursoCebraspe.id,
      subjectId: direitoConstitucional.id,
      topicId: principiosFundamentais.id,
      type: QuestionType.CE,
      statement:
        "A República Federativa do Brasil é formada pela união indissolúvel dos estados, dos municípios e do Distrito Federal.",
      ceAnswer: true,
    },
    {
      concursoId: concursoCebraspe.id,
      subjectId: raciocinioLogico.id,
      topicId: proposicoes.id,
      type: QuestionType.CE,
      statement:
        "A negação de 'Todos os candidatos foram aprovados' é 'Pelo menos um candidato não foi aprovado'.",
      ceAnswer: true,
    },
  ];

  for (const question of cebraspeQuestions) {
    await createOrUpdateQuestion(question);
  }

  /*
   * Concurso CESGRANRIO
   */
  const concursoCesgranrio = await createOrUpdateConcurso({
    bancaId: cesgranrio.id,
    orgao: "Simulado Demonstrativo",
    cargo: "Técnico Administrativo",
    ano: 2026,
  });

  await prisma.scoringRule.upsert({
    where: {
      concursoId: concursoCesgranrio.id,
    },
    update: {
      type: ScoringType.MC_NO_PENALTY,
      pointsCorrect: 1,
      pointsWrong: 0,
      pointsBlank: 0,
    },
    create: {
      concursoId: concursoCesgranrio.id,
      type: ScoringType.MC_NO_PENALTY,
      pointsCorrect: 1,
      pointsWrong: 0,
      pointsBlank: 0,
    },
  });

  const cesgranrioQuestions: QuestionSeed[] = [
    {
      concursoId: concursoCesgranrio.id,
      subjectId: linguaPortuguesa.id,
      topicId: gramatica.id,
      type: QuestionType.MC,
      statement:
        "Assinale a alternativa em que a concordância verbal está correta.",
      alternatives: [
        {
          letter: "A",
          text: "Fazem dois anos que o projeto começou.",
          isCorrect: false,
        },
        {
          letter: "B",
          text: "Existem boas oportunidades no setor público.",
          isCorrect: true,
        },
        {
          letter: "C",
          text: "Houveram muitos candidatos inscritos.",
          isCorrect: false,
        },
        {
          letter: "D",
          text: "Deve haverem novas vagas em breve.",
          isCorrect: false,
        },
        {
          letter: "E",
          text: "Falta cinco minutos para o início da prova.",
          isCorrect: false,
        },
      ],
    },
    {
      concursoId: concursoCesgranrio.id,
      subjectId: informatica.id,
      topicId: internetProtocolos.id,
      type: QuestionType.MC,
      statement:
        "Qual protocolo é utilizado para acessar páginas da internet com comunicação criptografada?",
      alternatives: [
        {
          letter: "A",
          text: "FTP",
          isCorrect: false,
        },
        {
          letter: "B",
          text: "SMTP",
          isCorrect: false,
        },
        {
          letter: "C",
          text: "HTTPS",
          isCorrect: true,
        },
        {
          letter: "D",
          text: "POP3",
          isCorrect: false,
        },
        {
          letter: "E",
          text: "Telnet",
          isCorrect: false,
        },
      ],
    },
    {
      concursoId: concursoCesgranrio.id,
      subjectId: matematica.id,
      topicId: porcentagem.id,
      type: QuestionType.MC,
      statement:
        "Um produto custa R$ 200,00 e recebeu desconto de 15%. Qual é o valor final?",
      alternatives: [
        {
          letter: "A",
          text: "R$ 160,00",
          isCorrect: false,
        },
        {
          letter: "B",
          text: "R$ 165,00",
          isCorrect: false,
        },
        {
          letter: "C",
          text: "R$ 170,00",
          isCorrect: true,
        },
        {
          letter: "D",
          text: "R$ 175,00",
          isCorrect: false,
        },
        {
          letter: "E",
          text: "R$ 185,00",
          isCorrect: false,
        },
      ],
    },
    {
      concursoId: concursoCesgranrio.id,
      subjectId: administracaoPublica.id,
      topicId: planejamento.id,
      type: QuestionType.MC,
      statement:
        "O planejamento que define os objetivos gerais e de longo prazo de uma organização é denominado:",
      alternatives: [
        {
          letter: "A",
          text: "Operacional",
          isCorrect: false,
        },
        {
          letter: "B",
          text: "Tático",
          isCorrect: false,
        },
        {
          letter: "C",
          text: "Estratégico",
          isCorrect: true,
        },
        {
          letter: "D",
          text: "Emergencial",
          isCorrect: false,
        },
        {
          letter: "E",
          text: "Corretivo",
          isCorrect: false,
        },
      ],
    },
    {
      concursoId: concursoCesgranrio.id,
      subjectId: direitoConstitucional.id,
      topicId: poderesEstado.id,
      type: QuestionType.MC,
      statement:
        "De acordo com a Constituição Federal, são Poderes da União:",
      alternatives: [
        {
          letter: "A",
          text: "Legislativo, Executivo e Judiciário",
          isCorrect: true,
        },
        {
          letter: "B",
          text: "Federal, Estadual e Municipal",
          isCorrect: false,
        },
        {
          letter: "C",
          text: "Civil, Militar e Eleitoral",
          isCorrect: false,
        },
        {
          letter: "D",
          text: "Político, Administrativo e Econômico",
          isCorrect: false,
        },
        {
          letter: "E",
          text: "Executivo, Ministerial e Judiciário",
          isCorrect: false,
        },
      ],
    },
  ];

  for (const question of cesgranrioQuestions) {
    await createOrUpdateQuestion(question);
  }

  /*
   * Usuário temporário para o MVP
   */
  await prisma.user.upsert({
    where: {
      email: "demo@simulador.local",
    },
    update: {
      name: "Usuário de demonstração",
    },
    create: {
      email: "demo@simulador.local",
      name: "Usuário de demonstração",
    },
  });

  const totalConcursos = await prisma.concurso.count();
  const totalQuestions = await prisma.question.count();
  const totalSubjects = await prisma.subject.count();

  console.log("Seed concluído com sucesso.");
  console.log({
    totalConcursos,
    totalQuestions,
    totalSubjects,
  });
}

main()
  .catch((error) => {
    console.error("Erro ao executar o seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });