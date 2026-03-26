import { calculateTDEE, calculateStepCalories, getMacroGoals } from './tdee'

describe('TDEE & Metabolism Calculator', () => {
  describe('calculateTDEE', () => {
    it('returns a standard 2000 kcal fallback if arguments are missing or gender is empty', () => {
      expect(calculateTDEE(0, 0, 0, '')).toBe(2000)
    })

    it('calculates correct base TDEE for a male (Mifflin-St Jeor x 1.2)', () => {
      // 80kg, 180cm, 25 years old. 
      // BMR = (10*80) + (6.25*180) - (5*25) + 5 = 800 + 1125 - 125 + 5 = 1805
      // TDEE = round(1805 * 1.2) = 2166
      expect(calculateTDEE(180, 80, 25, 'male')).toBe(2166)
    })

    it('calculates correct base TDEE for a female', () => {
      // 65kg, 165cm, 30 years old.
      // BMR = (10*65) + (6.25*165) - (5*30) - 161 = 650 + 1031.25 - 150 - 161 = 1370.25
      // TDEE = round(1370.25 * 1.2) = 1644
      expect(calculateTDEE(165, 65, 30, 'female')).toBe(1644)
    })
  })

  describe('calculateStepCalories', () => {
    it('calculates roughly 0.04 kcal per step', () => {
      expect(calculateStepCalories(10000)).toBe(400)
      expect(calculateStepCalories(5000)).toBe(200)
    })

    it('returns 0 if steps are missing', () => {
      expect(calculateStepCalories(NaN as any)).toBe(0)
    })
  })

  describe('getMacroGoals', () => {
    it('calculates dynamic weight-based macro splits correctly', () => {
      const weight = 80
      const tdee = 2166
      const stepKcal = 400
      // target = 2566
      // protein = 80 * 1.8 = 144g (576 kcal)
      // fat = 80 * 0.9 = 72g (648 kcal)
      // carbsKcal = 2566 - 576 - 648 = 1342 kcal => /4 = 336g
      
      const goals = getMacroGoals(weight, tdee, stepKcal)
      expect(goals.kcalGoal).toBe(2566)
      expect(goals.proteinGoal).toBe(144)
      expect(goals.fatGoal).toBe(72)
      expect(goals.carbsGoal).toBe(336)
    })

    it('prevents negative carbs if TDEE deficit is extreme compared to bodyweight goals', () => {
      // Example: 150kg but only eating 1000 kcal
      const goals = getMacroGoals(150, 1000, 0)
      // protein: 150*1.8 = 270g = 1080 kcal (already over limit!)
      // fat: 150*0.9 = 135g = 1215 kcal
      // total = 2295 kcal. carbs should floor at 0, not be negative.
      expect(goals.carbsGoal).toBe(0)
    })

    it('falls back to 25/50/25 percentage ratio if weight is completely unknown (e.g. 0)', () => {
      const goals = getMacroGoals(0, 2000, 200)
      // Target = 2200 kcal
      // Protein (25%): 550 kcal / 4 = 138g
      // Carbs (50%): 1100 kcal / 4 = 275g
      // Fat (25%): 550 kcal / 9 = 61.1g -> 61g
      expect(goals.kcalGoal).toBe(2200)
      expect(goals.proteinGoal).toBe(138)
      expect(goals.carbsGoal).toBe(275)
      expect(goals.fatGoal).toBe(61)
    })
  })
})
