// Browser copy of the content model (kept in sync with ../content.js by hand -
// it's small and rarely changes, so a build step felt like overkill).
window.CONTENT = {
  CATEGORIES: {
    A: { key: "A", label: "Direction & Empowerment", color: "#785AF2" },
    B: { key: "B", label: "Innovation & Experimentation", color: "#FFA740" },
    C: { key: "C", label: "Customer & Data Centricity", color: "#00AADF" },
    D: { key: "D", label: "Workload & Sustainability", color: "#4BBE37" },
    E: { key: "E", label: "Culture & Feedback", color: "#E166D5" },
    F: { key: "F", label: "GenAI Adoption", color: "#EFD500" },
  },

  SAY_STATEMENTS: [
    { key: "A", text: "I trust my team to find the answer to a problem. I'm just here to spar, not to decide for them." },
    { key: "B", text: "Every failed experiment is a learning opportunity. That's how we build a fail-fast culture." },
    { key: "C", text: "We're customer- and data-driven. The evidence decides, not opinions." },
    { key: "D", text: "Your wellbeing matters more than any deadline. Protect your evenings and your recovery." },
    { key: "E", text: "I want honest, open feedback. Give me constructive feedback, I appreciate it." },
    { key: "F", text: "We're all-in on AI. It's how we work smarter, and we use it daily." },
  ],

  DO_ITEMS: [
    { key: "A", text: "The moment it gets risky, I no longer give my team the trust to solve the problem themselves, I micromanage or override their solution afterward." },
    { key: "B", text: "The second an experiment doesn't deliver fast, I quietly pull its budget and my patience." },
    { key: "C", text: "When the data's inconvenient, I choose only the data points that confirm my belief. Or I cut corners, leaning on superficial or incomplete data instead of digging for the full picture." },
    { key: "D", text: "I still answer messages in the evenings or weekends, and everyone's noticed what that actually rewards." },
    { key: "E", text: "When someone actually gives me constructive feedback that touches a sore spot, I get defensive or quietly remember it." },
    { key: "F", text: "My team and I fire off AI prompts, but with little real automation or efficiency gain to show for it." },
  ],

  RESULTS: {
    A: {
      title: "Direction & Empowerment",
      body: "Your gap centers on Direction & Empowerment. You say you trust your team to own decisions and that you're there to support, not steer, but under pressure, senior opinions or internal politics tend to override the room's evidence, and “alignment” can turn into asking for agreement rather than input. The cost: your team learns to wait for your call instead of making their own, so you end up managing followers instead of growing leaders, and decisions slow down. Underneath it is often fear of losing control, or the illusion that people already have the context you're assuming, not a lack of good intent.",
    },
    B: {
      title: "Innovation & Experimentation",
      body: "Your gap centers on Innovation & Experimentation. You talk about the need for experiments and a fail-fast mindset, but in practice, projects rarely get killed cleanly (they become “zombie projects”), discovery time is squeezed to the bare minimum, and anything that doesn't show value immediately loses support fast. The cost: the work coasts on safe, incremental bets and misses the moments that would have mattered, while new hires who were promised space to experiment quietly disengage. It's not bad intent, usually loss aversion, sunk-cost thinking, or a calendar that's already 100% booked with “must-deliver” work.",
    },
    C: {
      title: "Customer & Data Centricity",
      body: "Your gap sits in Customer & Data Centricity. You describe decisions as evidence-led and outcome-focused, but in the moment, you cut corners: leaning on superficial or incomplete data instead of digging for the full picture, letting internal politics or strong stakeholder opinions quietly take the wheel, and measuring teams on shipping speed rather than the impact of what shipped. The cost: the work drifts from what the business or customers actually need, feature count grows while real traction doesn't, and the people who care most about data or UX get resentful. This isn't dishonesty, it's confirmation bias plus incentives that reward being right over being accurate.",
    },
    D: {
      title: "Workload & Sustainability",
      body: "Your gap is in Workload & Sustainability. You say boundaries and recovery matter, but your own always-on behavior sets the real expectation, and saying “no” to more work still quietly reads as lower commitment. The cost is a slow drift into being overworked as the norm: no real capacity buffer is built into the plan, technical debt and security work keep losing to “urgent” delivery, and team members, especially the high-performers, increasingly run on empty. It's rarely a leader who doesn't care, it's a culture reflex that mistakes being busy and always “on” with productivity or dedication.",
    },
    E: {
      title: "Culture & Feedback",
      body: "Your gap is in Culture & Feedback. You value transparency and open dialogue, but difficult news gets softened or delayed, dissenting views get talked over, and people who raise inconvenient truths sometimes pay a quiet social cost for it. The result: real problems stay hidden until they're a crisis, collaboration becomes performative (“nod now, do your own thing later”), and the people with the most different perspectives, though often useful, get frustrated, disengage, or leave. Underneath it is usually a psychological safety gap, not malice: giving feedback threatens ego before it helps anyone grow.",
    },
    F: {
      title: "GenAI Adoption",
      body: "Your gap is in GenAI Adoption. You talk about AI as core to how the team works, but real usage often stays shallow: you and your team fire off prompts with little real automation or efficiency gain to show for it, no real time or training invested, and effort or failed attempts quietly downplayed. The cost: competitors who invest properly pull ahead on speed, your team keeps burning hours on inefficient workflows sugarcoated with limited AI integration, and the few people who did figure it out can't scale their habits to anyone else. This is less about lack of willingness and more about uncertainty avoidance: how AI will ultimately permeate the work and leverage true efficiency gains still feels unpredictable, so people fall back to what's familiar, especially with no dedicated time or budget to actually learn it.",
    },
  },
};
