from random import randint


def rnd():
    return randint(1, 100)


def rndOf(*lst):
    return lst[randint(0, len(lst) - 1)]


def rndConst():
    return "new FunctionTree.Const(" + str(rnd()) + ")"


def rndVariable():
    return 'new FunctionTree.Variable(\"' + rndOf('x', 'y', 'z') + '\"")'


def rndAdd(i):
    def nxt():
        rec = rnd()

        if i < 3 and rec > 50:
            return rndAdd(i + 1)
        elif rec > 20:
            return rndConst()
        else:
            return rndVariable()
        return '?'

    return 'new FunctionTree.Add(' + nxt() + ', ' + nxt() + ')'


print(rndAdd(0) + ';')
