// O site fica em https://<usuario>.github.io/apps/, então só a versão web usa o subcaminho /apps.
// Nos apps de celular ele não pode existir, senão as atualizações (EAS Update) não encontram as imagens.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_WEB_BASE_URL ? { baseUrl: process.env.EXPO_WEB_BASE_URL } : {}),
  },
});
