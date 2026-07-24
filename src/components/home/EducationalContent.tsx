const TOPICS = [
  {
    title: "Cebraspe",
    text: "Em provas de Certo ou Errado, uma resposta incorreta pode descontar pontos. A configuração do concurso define a regra exata.",
  },
  {
    title: "Múltipla escolha",
    text: "Quando não há penalidade, a resposta errada vale zero. O cálculo continua respeitando a regra registrada para aquela prova.",
  },
  {
    title: "Pesos diferentes",
    text: "Questões e blocos podem ter importâncias distintas. O resultado usa o peso de cada questão, sem médias improvisadas.",
  },
  {
    title: "Revisão humana",
    text: "Provas importadas passam por conferência de fonte, enunciado, alternativas e gabarito antes da publicação.",
  },
];

export function EducationalContent() {
  return (
    <section
      aria-labelledby="como-funciona"
      className="bg-[#07110f] py-20 text-white"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-400">
          Como a nota funciona
        </p>
        <h2 id="como-funciona" className="mt-3 text-3xl font-bold">
          A regra da prova, sem atalhos
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TOPICS.map((topic, index) => (
            <article
              key={topic.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-6"
            >
              <span className="text-sm font-bold text-amber-400">
                0{index + 1}
              </span>
              <h3 className="mt-4 text-lg font-bold">{topic.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {topic.text}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
