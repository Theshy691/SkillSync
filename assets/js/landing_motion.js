(() => {
  const motion = window.matchMedia('(prefers-reduced-motion: no-preference)');
  const report = document.querySelector('.comparison-preview');
  const picker = document.getElementById('sampleRolePicker');

  if (report && picker) {
    const fields = ['heroRoleVal', 'heroScoreVal', 'heroSummaryTitle', 'heroPreviewCopy',
      'heroSkillOne', 'heroSkillTwo', 'heroGapVal'].map(id => document.getElementById(id));
    const samples = {
      fullStack: fields.map(field => field.textContent),
      backend: [
        'Backend Engineer', '67%', 'A few areas to review.',
        'The sample resume shows database and API experience. Terraform is a gap to explore.',
        'PostgreSQL', 'API development', 'Terraform'
      ]
    };
    const buttons = [...picker.querySelectorAll('button')];
    const status = document.getElementById('sampleRoleStatus');

    for (const button of buttons) {
      button.addEventListener('click', () => {
        if (button.getAttribute('aria-pressed') === 'true') return;

        const sample = samples[button.dataset.sampleRole];
        fields.forEach((field, index) => { field.textContent = sample[index]; });
        buttons.forEach(option => option.setAttribute('aria-pressed', String(option === button)));
        status.textContent = `${sample[0]} sample, ${sample[1]} keyword match. Review ${sample[6]}.`;

        if (motion.matches) {
          report.classList.remove('is-in-view');
          // Commit the reset before replaying the CSS sequence.
          void report.offsetWidth;
          report.classList.add('is-in-view');
        }
      });
    }
    picker.hidden = false;
  }

  if (!motion.matches || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in-view');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.35 });

  document.querySelectorAll('[data-landing-motion]').forEach(element => observer.observe(element));
})();
