import unittest
from run import expand, compatible, strength, profile_values, verify
from run_turn import runouts


class IndependentEvaluatorTests(unittest.TestCase):
    board = ["Ks","7d","2c","8h","3d"]

    def test_blocking_and_showdowns(self):
        oop=expand("KK,A4s,A5s",self.board); ip=expand("TT,JJ",self.board)
        self.assertEqual([len(oop),len(ip)],[11,12])
        pairs=[(o,i) for o in oop for i in ip if compatible(o,i)]
        self.assertEqual(len(pairs),132)
        from run import cards
        wins=sum(strength(cards(o)+self.board)>strength(cards(i)+self.board) for o,i in pairs)
        self.assertEqual(wins,36)
        self.assertEqual(len(expand("KK",["Ks","Kd","2c","8h","3d"])),1)
        self.assertEqual(len(expand("KK",["Ks","Kd","Kh","8h","3d"])),0)

    def test_zero_compatible_mass_is_not_a_zero_ev(self):
        self.assertFalse(compatible("As4s","AsTs"))
        self.assertFalse(compatible("As4s","Ts4s"))
        self.assertTrue(compatible("As4s","AdTd"))

    def test_evaluator_wheel_flush_and_full_house(self):
        self.assertEqual(strength("As 2d 3c 4h 5s Kd Qd".split()),(4,5))
        self.assertEqual(strength("As Ks Qs Js Ts 2c 3c".split()),(8,14))
        self.assertEqual(strength("As Ad Ah Ks Kd 2c 3c".split()),(6,14,13))

    def test_turn_runouts_remove_both_players_cards_and_recover_exact_equity(self):
        board=tuple(self.board[:4])
        self.assertEqual([len(expand(r,list(board))) for r in ['KK,A4s,A5s','TT,JJ']],[11,12])
        value=runouts(board,'KhKc','TdTc');bluff=runouts(board,'As4s','TdTc')
        self.assertEqual(len(value),44);self.assertEqual(set(value.values()),{1})
        self.assertEqual(sum(v==1 for v in bluff.values()),3)
        self.assertNotIn('As',bluff);self.assertNotIn('4s',bluff);self.assertNotIn('Td',bluff);self.assertNotIn('Ks',bluff)
        self.assertEqual(sum(bluff.values())/44,-19/22)


if __name__ == "__main__": unittest.main()
