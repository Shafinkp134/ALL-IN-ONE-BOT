#include <a_samp>

#define COLOR_WHITE 0xFFFFFFFF
#define COLOR_GREEN 0x33FF33FF
#define COLOR_YELLOW 0xFFFF00FF
#define COLOR_RED 0xFF3333FF
#define COLOR_GRAY 0xAAAAAAFF

#define DIALOG_STATS 1000

enum pData
{
    pKills,
    pDeaths,
    pCashEarned
};

new PlayerData[MAX_PLAYERS][pData];

public OnGameModeInit()
{
    SetGameModeText("ALL-IN-ONE Roleplay");
    UsePlayerPedAnims();
    ShowNameTags(1);
    ShowPlayerMarkers(1);
    DisableInteriorEnterExits();
    EnableStuntBonusForAll(0);

    AddPlayerClass(0, 1958.3783, 1343.1572, 15.3746, 269.1067, 0, 0, 0, 0, 0, 0);
    AddPlayerClass(7, 1685.8474, 1327.6101, 10.7669, 268.7025, 0, 0, 0, 0, 0, 0);
    AddPlayerClass(15, 1458.3906, 750.0596, 10.8203, 90.0000, 0, 0, 0, 0, 0, 0);

    print("[ALL-IN-ONE] Gamemode loaded.");
    return 1;
}

public OnGameModeExit()
{
    print("[ALL-IN-ONE] Gamemode unloaded.");
    return 1;
}

public OnPlayerConnect(playerid)
{
    PlayerData[playerid][pKills] = 0;
    PlayerData[playerid][pDeaths] = 0;
    PlayerData[playerid][pCashEarned] = 0;

    SendClientMessage(playerid, COLOR_GREEN, "Welcome to ALL-IN-ONE SA-MP!");
    SendClientMessage(playerid, COLOR_GRAY, "Type /help for commands.");
    return 1;
}

public OnPlayerDisconnect(playerid, reason)
{
    PlayerData[playerid][pKills] = 0;
    PlayerData[playerid][pDeaths] = 0;
    PlayerData[playerid][pCashEarned] = 0;
    return 1;
}

public OnPlayerSpawn(playerid)
{
    SetPlayerColor(playerid, COLOR_YELLOW);
    GivePlayerMoney(playerid, 500);
    return 1;
}

public OnPlayerDeath(playerid, killerid, reason)
{
    PlayerData[playerid][pDeaths]++;

    if (killerid != INVALID_PLAYER_ID)
    {
        PlayerData[killerid][pKills]++;
        GivePlayerMoney(killerid, 250);
        PlayerData[killerid][pCashEarned] += 250;
    }
    return 1;
}

public OnPlayerCommandText(playerid, cmdtext[])
{
    new cmd[32];
    new idx = 0;
    cmd = strtok(cmdtext, idx);

    if (strcmp(cmd, "/help", true) == 0)
    {
        SendClientMessage(playerid, COLOR_WHITE, "Commands: /help /stats /givecash /setskin");
        return 1;
    }

    if (strcmp(cmd, "/stats", true) == 0)
    {
        new message[144];
        format(message, sizeof(message),
            "Kills: %d\nDeaths: %d\nCash Earned: $%d",
            PlayerData[playerid][pKills],
            PlayerData[playerid][pDeaths],
            PlayerData[playerid][pCashEarned]);
        ShowPlayerDialog(playerid, DIALOG_STATS, DIALOG_STYLE_MSGBOX, "Your Stats", message, "Close", "");
        return 1;
    }

    if (strcmp(cmd, "/givecash", true) == 0)
    {
        new targetId = strval(strtok(cmdtext, idx));
        new amount = strval(strtok(cmdtext, idx));

        if (!IsPlayerConnected(targetId) || amount <= 0)
        {
            SendClientMessage(playerid, COLOR_RED, "Usage: /givecash <playerid> <amount>");
            return 1;
        }

        if (GetPlayerMoney(playerid) < amount)
        {
            SendClientMessage(playerid, COLOR_RED, "You don't have enough cash.");
            return 1;
        }

        GivePlayerMoney(playerid, -amount);
        GivePlayerMoney(targetId, amount);
        PlayerData[targetId][pCashEarned] += amount;

        SendClientMessage(playerid, COLOR_GREEN, "Cash sent.");
        SendClientMessage(targetId, COLOR_YELLOW, "You received cash.");
        return 1;
    }

    if (strcmp(cmd, "/setskin", true) == 0)
    {
        new skinId = strval(strtok(cmdtext, idx));

        if (skinId < 0 || skinId > 311)
        {
            SendClientMessage(playerid, COLOR_RED, "Usage: /setskin <0-311>");
            return 1;
        }

        SetPlayerSkin(playerid, skinId);
        SendClientMessage(playerid, COLOR_GREEN, "Skin updated.");
        return 1;
    }

    return 0;
}

stock strtok(const string[], &index)
{
    new length = strlen(string);
    while ((index < length) && (string[index] <= ' '))
    {
        index++;
    }

    new offset = index;
    new result[64];

    while ((index < length) && (string[index] > ' '))
    {
        result[index - offset] = string[index];
        index++;
    }

    result[index - offset] = EOS;
    return result;
}
